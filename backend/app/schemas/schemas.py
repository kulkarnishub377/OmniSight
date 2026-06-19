from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    role: str
    email: EmailStr


class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = {'from_attributes': True}


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = 'Viewer'


class OmniSightEventIn(BaseModel):
    schema_version: str = '1.0'
    event_id: str = Field(default_factory=lambda: f'evt_{uuid4().hex[:16]}')
    source_id: str
    source_type: str
    source_sequence: Optional[int] = None
    event_type: str
    severity: str = 'low'
    timestamp: datetime = Field(default_factory=now_utc)
    tenant_id: str = 'demo_tenant'
    location: Dict[str, Any] = Field(default_factory=dict)
    payload: Dict[str, Any] = Field(default_factory=dict)
    trace: Dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    event_id: str
    schema_version: str
    tenant_id: str
    source_id: str
    source_type: str
    source_sequence: Optional[int]
    event_type: str
    severity: str
    timestamp: datetime
    location: Dict[str, Any]
    payload: Dict[str, Any]
    trace: Dict[str, Any]
    status: str
    created_at: datetime


class IncidentOut(BaseModel):
    incident_id: str
    tenant_id: str
    title: str
    severity: str
    status: str
    risk_score: Optional[float]
    summary: Optional[str]
    risk_indicators: List[str]
    related_events: List[str]
    created_at: datetime
    updated_at: datetime


class AlertOut(BaseModel):
    alert_id: str
    tenant_id: str
    incident_id: str
    severity: str
    status: str
    message: str
    created_at: datetime
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]


class DocumentOut(BaseModel):
    document_id: str
    tenant_id: str
    file_name: str
    document_type: str
    asset_id: Optional[str]
    chunk_count: int
    text: str
    created_at: datetime


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    tenant_id: str = 'demo_tenant'
    top_k: int = Field(default=5, ge=1, le=20)
    asset_id: Optional[str] = None


class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    score: float
    text: str
    metadata: Dict[str, Any]


class SearchResponse(BaseModel):
    query: str
    hits: List[SearchHit]


class AgentRunOut(BaseModel):
    run_id: str
    incident_id: str
    workflow_version: str
    status: str
    input: Dict[str, Any]
    output: Dict[str, Any]
    trace: List[Dict[str, Any]]
    created_at: datetime


class VisionMockRequest(BaseModel):
    source_id: str = 'camera_warehouse_a_01'
    object_name: str = 'forklift'
    confidence: float = 0.94
    zone: str = 'restricted_zone'
    site: str = 'plant_1'
    building: str = 'warehouse'


class TemperatureSensorRequest(BaseModel):
    source_id: str = 'temp_sensor_machine_a'
    machine_id: str = 'machine_a'
    temperature_celsius: float = 91.5
    threshold_celsius: float = 80.0
    zone: str = 'restricted_zone'
    site: str = 'plant_1'


class AcknowledgeRequest(BaseModel):
    note: Optional[str] = None

class AudioMockRequest(BaseModel):
    source_id: str = 'microphone_line_1'
    text: str = 'machine noise increasing near machine A'
    speaker: str = 'unknown'
    zone: str = 'restricted_zone'
    site: str = 'plant_1'
    confidence: float = 0.91


class NotificationRequest(BaseModel):
    incident_id: str
    channel: str = 'dashboard'
    message: str


class ActionOut(BaseModel):
    action_id: str
    incident_id: str
    action_type: str
    status: str
    payload: Dict[str, Any]
    created_at: datetime


class AuditLogOut(BaseModel):
    audit_id: str
    tenant_id: str
    actor: str
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeGraphOut(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class SystemStats(BaseModel):
    events: int
    incidents: int
    alerts: int
    documents: int
    agent_runs: int
    audit_logs: int
    topics: Dict[str, str]

class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    risk_score: Optional[float] = Field(default=None, ge=0, le=1)
    summary: Optional[str] = None
