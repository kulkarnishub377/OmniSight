"""Camera connector stub.

In production this connector would poll RTSP/IP cameras, run frames through the
Vision Service, and publish canonical AMIF events to Redpanda. For the MVP it
shows the exact event contract expected by `/api/events`.
"""
from datetime import datetime, timezone


def forklift_detected_event(source_id='camera_warehouse_a_01') -> dict:
    return {
        'schema_version': '1.0',
        'source_id': source_id,
        'source_type': 'camera',
        'event_type': 'forklift_detected',
        'severity': 'medium',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tenant_id': 'demo_tenant',
        'location': {'site': 'plant_1', 'building': 'warehouse', 'zone': 'restricted_zone'},
        'payload': {'object': 'forklift', 'confidence': 0.94, 'bbox': [120, 84, 420, 360]},
        'trace': {'producer': 'camera_connector'},
    }
