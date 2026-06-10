import os
import time
from datetime import datetime, timezone
from typing import Any

import happybase

SENSORS_TABLE = "sensors"
READINGS_TABLE = "sensor_readings"


def get_connection() -> happybase.Connection:
    host = os.getenv("HBASE_HOST", "localhost")
    port = int(os.getenv("HBASE_PORT", "9090"))
    return happybase.Connection(host=host, port=port, timeout=20000, autoconnect=True)


def ensure_tables() -> None:
    last_error: Exception | None = None
    for _ in range(30):
        connection = None
        try:
            connection = get_connection()
            existing = {name.decode("utf-8") for name in connection.tables()}
            if SENSORS_TABLE not in existing:
                connection.create_table(
                    SENSORS_TABLE,
                    {
                        "info": dict(),
                        "location": dict(),
                        "device": dict(),
                    },
                )
            if READINGS_TABLE not in existing:
                connection.create_table(
                    READINGS_TABLE,
                    {
                        "metrics": dict(),
                        "device": dict(),
                        "alert": dict(),
                        "time": dict(),
                    },
                )
            return
        except Exception as exc:
            last_error = exc
            time.sleep(2)
        finally:
            if connection is not None:
                connection.close()
    raise RuntimeError(f"HBase was not ready: {last_error}")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def reading_key(sensor_id: str, timestamp: str) -> str:
    return f"{sensor_id}#{timestamp}"


def decode_row(row_key: bytes, data: dict[bytes, bytes]) -> dict[str, Any]:
    decoded: dict[str, Any] = {"row_key": row_key.decode("utf-8")}
    for key, value in data.items():
        family, qualifier = key.decode("utf-8").split(":", 1)
        decoded.setdefault(family, {})[qualifier] = value.decode("utf-8")
    return decoded


def flatten_sensor(row: dict[str, Any]) -> dict[str, Any]:
    info = row.get("info", {})
    location = row.get("location", {})
    device = row.get("device", {})
    return {
        "sensor_id": row["row_key"],
        "name": info.get("name"),
        "sensor_type": info.get("sensor_type"),
        "status": info.get("status"),
        "latitude": _float(location.get("latitude")),
        "longitude": _float(location.get("longitude")),
        "city": location.get("city"),
        "country": location.get("country"),
        "model": device.get("model"),
        "firmware": device.get("firmware"),
    }


def flatten_reading(row: dict[str, Any]) -> dict[str, Any]:
    metrics = row.get("metrics", {})
    device = row.get("device", {})
    alert = row.get("alert", {})
    time = row.get("time", {})
    sensor_id, timestamp_from_key = row["row_key"].split("#", 1)
    return {
        "row_key": row["row_key"],
        "sensor_id": sensor_id,
        "timestamp": time.get("timestamp", timestamp_from_key),
        "temperature": _float(metrics.get("temperature")),
        "humidity": _float(metrics.get("humidity")),
        "pressure": _float(metrics.get("pressure")),
        "battery": _float(device.get("battery")),
        "signal_strength": _int(device.get("signal_strength")),
        "alert_level": alert.get("level"),
        "alert_message": alert.get("message"),
    }


def sensor_columns(payload: dict[str, Any]) -> dict[str, str]:
    return {
        "info:name": payload["name"],
        "info:sensor_type": payload["sensor_type"],
        "info:status": payload["status"],
        "location:latitude": str(payload["latitude"]),
        "location:longitude": str(payload["longitude"]),
        "location:city": payload["city"],
        "location:country": payload["country"],
        "device:model": payload["model"],
        "device:firmware": payload["firmware"],
    }


def reading_columns(payload: dict[str, Any], alert_level: str, alert_message: str) -> dict[str, str]:
    return {
        "metrics:temperature": str(payload["temperature"]),
        "metrics:humidity": str(payload["humidity"]),
        "metrics:pressure": str(payload["pressure"]),
        "device:battery": str(payload["battery"]),
        "device:signal_strength": str(payload["signal_strength"]),
        "time:timestamp": payload["timestamp"],
        "alert:level": alert_level,
        "alert:message": alert_message,
    }


def evaluate_alert(temperature: float, humidity: float, battery: float) -> tuple[str, str]:
    messages = []
    if temperature >= 35:
        messages.append("high temperature")
    if humidity <= 30:
        messages.append("low humidity")
    if battery < 20:
        messages.append("battery below 20%")

    if len(messages) >= 2 or temperature >= 40 or battery < 10:
        return "critical", ", ".join(messages)
    if messages:
        return "warning", ", ".join(messages)
    return "ok", "normal"


def b(value: str) -> bytes:
    return value.encode("utf-8")


def byte_columns(columns: dict[str, str]) -> dict[bytes, bytes]:
    return {b(key): b(value) for key, value in columns.items()}


def _float(value: Any) -> float | None:
    return None if value is None else float(value)


def _int(value: Any) -> int | None:
    return None if value is None else int(value)
