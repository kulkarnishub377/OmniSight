"""IoT connector stub for temperature/vibration/energy readings."""
from datetime import datetime, timezone


def temperature_event(machine_id='machine_a', temperature=91.5, threshold=80.0) -> dict:
    return {
        'schema_version': '1.0',
        'source_id': f'temp_sensor_{machine_id}',
        'source_type': 'iot_sensor',
        'event_type': 'temperature_reading',
        'severity': 'high' if temperature > threshold else 'low',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tenant_id': 'demo_tenant',
        'location': {'site': 'plant_1', 'zone': 'restricted_zone'},
        'payload': {'machine_id': machine_id, 'temperature_celsius': temperature, 'threshold_celsius': threshold},
        'trace': {'producer': 'iot_connector'},
    }
