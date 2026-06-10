import argparse
import random
import time
from datetime import datetime, timezone

import requests

LOCATIONS = [
    {
        "sensor_id": "sensor-sp-01",
        "name": "Sao Paulo campus roof",
        "city": "Sao Paulo",
        "country": "Brazil",
        "latitude": -23.5505,
        "longitude": -46.6333,
        "base_temp": 24.0,
        "base_humidity": 62.0,
        "base_pressure": 1014.0,
    },
    {
        "sensor_id": "sensor-rj-01",
        "name": "Rio de Janeiro coastal station",
        "city": "Rio de Janeiro",
        "country": "Brazil",
        "latitude": -22.9068,
        "longitude": -43.1729,
        "base_temp": 28.0,
        "base_humidity": 72.0,
        "base_pressure": 1011.0,
    },
    {
        "sensor_id": "sensor-bsb-01",
        "name": "Brasilia dry-air station",
        "city": "Brasilia",
        "country": "Brazil",
        "latitude": -15.7939,
        "longitude": -47.8828,
        "base_temp": 26.0,
        "base_humidity": 42.0,
        "base_pressure": 1016.0,
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate simulated IoT readings and send them to the API.")
    parser.add_argument("--api", default="http://localhost:8000", help="Base URL for the FastAPI service")
    parser.add_argument("--cycles", type=int, default=5, help="Number of reading batches to send")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds between batches")
    args = parser.parse_args()

    ensure_sensors(args.api)
    for cycle in range(args.cycles):
        for location in LOCATIONS:
            reading = generate_reading(location, cycle)
            response = requests.post(f"{args.api}/readings", json=reading, timeout=10)
            response.raise_for_status()
            saved = response.json()
            print(
                f"{saved['row_key']} temp={saved['temperature']}C "
                f"humidity={saved['humidity']}% alert={saved['alert_level']}"
            )
        if cycle < args.cycles - 1:
            time.sleep(args.interval)


def ensure_sensors(api: str) -> None:
    for location in LOCATIONS:
        payload = {
            "sensor_id": location["sensor_id"],
            "name": location["name"],
            "sensor_type": "environmental",
            "status": "active",
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "city": location["city"],
            "country": location["country"],
            "model": "ENV-100",
            "firmware": "1.0.0",
        }
        response = requests.post(f"{api}/sensors", json=payload, timeout=10)
        if response.status_code not in (201, 409):
            response.raise_for_status()


def generate_reading(location: dict, cycle: int) -> dict:
    force_alert = cycle % 5 == 4
    temperature = location["base_temp"] + random.uniform(-2.5, 4.0)
    humidity = location["base_humidity"] + random.uniform(-12.0, 8.0)
    battery = random.uniform(15.0, 98.0) if force_alert else random.uniform(35.0, 100.0)
    if force_alert and location["sensor_id"] == "sensor-bsb-01":
        humidity = random.uniform(20.0, 29.0)
    if force_alert and location["sensor_id"] == "sensor-rj-01":
        temperature = random.uniform(35.0, 39.0)

    return {
        "sensor_id": location["sensor_id"],
        "temperature": round(temperature, 2),
        "humidity": round(max(5.0, min(100.0, humidity)), 2),
        "pressure": round(location["base_pressure"] + random.uniform(-5.0, 5.0), 2),
        "battery": round(battery, 2),
        "signal_strength": random.randint(-88, -42),
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }


if __name__ == "__main__":
    main()
