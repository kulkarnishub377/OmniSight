from enum import StrEnum


class Role(StrEnum):
    ADMIN = 'Admin'
    OPERATOR = 'Operator'
    ANALYST = 'Analyst'
    VIEWER = 'Viewer'
    SERVICE_ACCOUNT = 'ServiceAccount'


class IncidentStatus(StrEnum):
    OPEN = 'open'
    ACKNOWLEDGED = 'acknowledged'
    RESOLVED = 'resolved'
    CLOSED = 'closed'


class AlertStatus(StrEnum):
    OPEN = 'open'
    ACKNOWLEDGED = 'acknowledged'
    RESOLVED = 'resolved'
