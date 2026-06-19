import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, default=uuid_str)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(64), nullable=False, default='Viewer')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Event(Base):
    __tablename__ = 'events'
    __table_args__ = (
        UniqueConstraint('tenant_id', 'source_id', 'source_sequence', name='uq_event_source_sequence'),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    schema_version = Column(String(16), nullable=False, default='1.0')
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    source_id = Column(String(128), nullable=False, index=True)
    source_type = Column(String(64), nullable=False)
    source_sequence = Column(Integer, nullable=True)
    event_type = Column(String(128), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default='low')
    timestamp = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    location_json = Column(Text, nullable=False, default='{}')
    payload_json = Column(Text, nullable=False, default='{}')
    trace_json = Column(Text, nullable=False, default='{}')
    status = Column(String(32), nullable=False, default='raw')
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Incident(Base):
    __tablename__ = 'incidents'

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    dedupe_key = Column(String(255), unique=True, nullable=True, index=True)
    title = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False, default='medium')
    status = Column(String(32), nullable=False, default='open')
    risk_score = Column(Float, nullable=True)
    summary = Column(Text, nullable=True)
    risk_indicators_json = Column(Text, nullable=False, default='[]')
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow)

    events = relationship('IncidentEvent', back_populates='incident', cascade='all, delete-orphan')
    alerts = relationship('Alert', back_populates='incident')
    agent_runs = relationship('AgentRun', back_populates='incident')


class IncidentEvent(Base):
    __tablename__ = 'incident_events'
    __table_args__ = (UniqueConstraint('incident_id', 'event_id', name='uq_incident_event'),)

    id = Column(Integer, primary_key=True)
    incident_id = Column(String(64), ForeignKey('incidents.incident_id'), nullable=False, index=True)
    event_id = Column(String(64), nullable=False, index=True)
    relation_type = Column(String(64), nullable=False, default='related')
    created_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship('Incident', back_populates='events')


class Alert(Base):
    __tablename__ = 'alerts'

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    incident_id = Column(String(64), ForeignKey('incidents.incident_id'), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default='medium')
    status = Column(String(32), nullable=False, default='open')
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(255), nullable=True)

    incident = relationship('Incident', back_populates='alerts')


class Document(Base):
    __tablename__ = 'documents'

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    file_name = Column(String(255), nullable=False)
    document_type = Column(String(64), nullable=False, default='manual')
    asset_id = Column(String(128), nullable=True, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    chunks = relationship('DocumentChunk', back_populates='document', cascade='all, delete-orphan')


class DocumentChunk(Base):
    __tablename__ = 'document_chunks'

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    document_id = Column(String(64), ForeignKey('documents.document_id'), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False, default='{}')
    embedding_json = Column(Text, nullable=False, default='[]')
    created_at = Column(DateTime(timezone=True), default=utcnow)

    document = relationship('Document', back_populates='chunks')


class AgentRun(Base):
    __tablename__ = 'agent_runs'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    incident_id = Column(String(64), ForeignKey('incidents.incident_id'), nullable=False, index=True)
    workflow_version = Column(String(32), nullable=False, default='1.0')
    status = Column(String(32), nullable=False, default='completed')
    input_json = Column(Text, nullable=False, default='{}')
    output_json = Column(Text, nullable=False, default='{}')
    trace_json = Column(Text, nullable=False, default='[]')
    created_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship('Incident', back_populates='agent_runs')


class ActionResult(Base):
    __tablename__ = 'action_results'

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    incident_id = Column(String(64), nullable=False, index=True)
    action_type = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String(64), unique=True, nullable=False, index=True, default=uuid_str)
    tenant_id = Column(String(64), nullable=False, default='demo_tenant', index=True)
    actor = Column(String(255), nullable=False)
    action = Column(String(128), nullable=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(String(128), nullable=True)
    metadata_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime(timezone=True), default=utcnow)
