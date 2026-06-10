import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.hbase_client import ensure_tables


if __name__ == "__main__":
    ensure_tables()
    print("HBase tables are ready: sensors, sensor_readings")
