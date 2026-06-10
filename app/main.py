from statistics import mean

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.hbase_client import (
    READINGS_TABLE,
    SENSORS_TABLE,
    decode_row,
    ensure_tables,
    evaluate_alert,
    flatten_reading,
    flatten_sensor,
    get_connection,
    now_iso,
    reading_columns,
    reading_key,
    sensor_columns,
    b,
    byte_columns,
)
from app.models import ReadingDeleteIn, ReadingIn, SensorIn, SensorPatch

app = FastAPI(title="IoT Environmental Monitoring with HBase")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_tables()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": "hbase"}


@app.post("/sensors", status_code=201)
def create_sensor(sensor: SensorIn) -> dict:
    payload = sensor.model_dump()
    connection = get_connection()
    try:
        table = connection.table(SENSORS_TABLE)
        if table.row(b(sensor.sensor_id)):
            raise HTTPException(status_code=409, detail="Sensor already exists")
        table.put(b(sensor.sensor_id), byte_columns(sensor_columns(payload)))
    finally:
        connection.close()
    return get_sensor(sensor.sensor_id)


@app.get("/sensors")
def list_sensors() -> list[dict]:
    connection = get_connection()
    try:
        table = connection.table(SENSORS_TABLE)
        return [flatten_sensor(decode_row(key, row)) for key, row in table.scan()]
    finally:
        connection.close()


@app.get("/sensors/{sensor_id}")
def get_sensor(sensor_id: str) -> dict:
    connection = get_connection()
    try:
        table = connection.table(SENSORS_TABLE)
        row = table.row(b(sensor_id))
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return flatten_sensor(decode_row(sensor_id.encode("utf-8"), row))


@app.patch("/sensors/{sensor_id}")
def update_sensor(sensor_id: str, patch: SensorPatch) -> dict:
    current = get_sensor(sensor_id)
    updated = {**current, **patch.model_dump(exclude_unset=True)}
    updated["sensor_id"] = sensor_id
    connection = get_connection()
    try:
        connection.table(SENSORS_TABLE).put(b(sensor_id), byte_columns(sensor_columns(updated)))
    finally:
        connection.close()
    return get_sensor(sensor_id)


@app.delete("/sensors/{sensor_id}")
def delete_sensor(sensor_id: str) -> dict[str, str]:
    connection = get_connection()
    try:
        table = connection.table(SENSORS_TABLE)
        if not table.row(b(sensor_id)):
            raise HTTPException(status_code=404, detail="Sensor not found")
        table.delete(b(sensor_id))
    finally:
        connection.close()
    return {"status": "deleted", "sensor_id": sensor_id}


@app.post("/readings", status_code=201)
def insert_reading(reading: ReadingIn) -> dict:
    payload = reading.model_dump()
    payload["timestamp"] = payload["timestamp"] or now_iso()
    get_sensor(payload["sensor_id"])
    alert_level, alert_message = evaluate_alert(
        payload["temperature"], payload["humidity"], payload["battery"]
    )
    key = reading_key(payload["sensor_id"], payload["timestamp"])
    connection = get_connection()
    try:
        connection.table(READINGS_TABLE).put(
            b(key), byte_columns(reading_columns(payload, alert_level, alert_message))
        )
    finally:
        connection.close()
    return get_reading_by_key(key)


@app.get("/readings/{sensor_id}")
def list_readings(sensor_id: str, limit: int = Query(default=100, ge=1, le=1000)) -> list[dict]:
    prefix = f"{sensor_id}#"
    connection = get_connection()
    try:
        table = connection.table(READINGS_TABLE)
        rows = [
            flatten_reading(decode_row(key, row))
            for key, row in table.scan(row_prefix=b(prefix), limit=limit)
        ]
    finally:
        connection.close()
    return sorted(rows, key=lambda item: item["timestamp"])


@app.get("/readings/{sensor_id}/latest")
def latest_reading(sensor_id: str) -> dict:
    readings = list_readings(sensor_id, limit=1000)
    if not readings:
        raise HTTPException(status_code=404, detail="No readings found for sensor")
    return max(readings, key=lambda item: item["timestamp"])


@app.delete("/readings/{sensor_id}")
def delete_reading(sensor_id: str, payload: ReadingDeleteIn) -> dict[str, str]:
    key = reading_key(sensor_id, payload.timestamp)
    connection = get_connection()
    try:
        table = connection.table(READINGS_TABLE)
        if not table.row(b(key)):
            raise HTTPException(status_code=404, detail="Reading not found")
        table.delete(b(key))
    finally:
        connection.close()
    return {"status": "deleted", "row_key": key}


@app.get("/alerts")
def list_alerts(sensor_id: str | None = None, limit: int = Query(default=100, ge=1, le=1000)) -> list[dict]:
    prefix = f"{sensor_id}#" if sensor_id else None
    connection = get_connection()
    try:
        table = connection.table(READINGS_TABLE)
        scanner = table.scan(row_prefix=b(prefix), limit=limit) if prefix else table.scan(limit=limit)
        readings = [flatten_reading(decode_row(key, row)) for key, row in scanner]
    finally:
        connection.close()
    return [reading for reading in readings if reading["alert_level"] != "ok"]


@app.get("/stats")
def statistics(sensor_id: str | None = None) -> dict:
    prefix = f"{sensor_id}#" if sensor_id else None
    connection = get_connection()
    try:
        table = connection.table(READINGS_TABLE)
        scanner = table.scan(row_prefix=b(prefix)) if prefix else table.scan()
        readings = [flatten_reading(decode_row(key, row)) for key, row in scanner]
    finally:
        connection.close()

    temperatures = [item["temperature"] for item in readings if item["temperature"] is not None]
    latest = sorted(readings, key=lambda item: item["timestamp"], reverse=True)[:5]
    return {
        "sensor_id": sensor_id,
        "total_readings": len(readings),
        "average_temperature": round(mean(temperatures), 2) if temperatures else None,
        "min_temperature": min(temperatures) if temperatures else None,
        "max_temperature": max(temperatures) if temperatures else None,
        "latest_readings": latest,
    }


def get_reading_by_key(key: str) -> dict:
    connection = get_connection()
    try:
        row = connection.table(READINGS_TABLE).row(b(key))
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="Reading not found")
    return flatten_reading(decode_row(key.encode("utf-8"), row))
