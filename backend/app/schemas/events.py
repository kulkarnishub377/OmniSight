from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime

class OmniSightEvent(BaseModel):
    schema_version: str = Field(..., description="Version of the event schema")
    event_id: str = Field(..., description="Unique event identifier")
    source_id: str = Field(..., description="Sensor or camera ID")
    source_type: str = Field(..., description="Type of source (e.g., camera, sensor, audio)")
    event_type: str = Field(..., description="Classification of the event")
    severity: str = Field("low", description="Severity level: low, medium, high, critical")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Dict[str, Any] = Field(default_factory=dict, description="Raw or parsed metric data")

class DLQEvent(BaseModel):
    error_reason: str = Field(..., description="Why this event was rejected")
    original_payload: str = Field(..., description="The raw unparsed JSON string")
    rejected_at: datetime = Field(default_factory=datetime.utcnow)
