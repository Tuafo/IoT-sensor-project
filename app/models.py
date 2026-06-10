from typing import Optional

from pydantic import BaseModel, Field


class SensorIn(BaseModel):
    sensor_id: str = Field(..., examples=["sensor-sp-01"])
    name: str = Field(..., examples=["Sao Paulo rooftop sensor"])
    sensor_type: str = Field(default="environmental")
    status: str = Field(default="active")
    latitude: float
    longitude: float
    city: str
    country: str = Field(default="Brazil")
    model: str = Field(default="ENV-100")
    firmware: str = Field(default="1.0.0")


class SensorPatch(BaseModel):
    name: Optional[str] = None
    sensor_type: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None
    model: Optional[str] = None
    firmware: Optional[str] = None


class ReadingIn(BaseModel):
    sensor_id: str
    temperature: float
    humidity: float
    pressure: float
    battery: float
    signal_strength: int
    timestamp: Optional[str] = None


class ReadingDeleteIn(BaseModel):
    timestamp: str
