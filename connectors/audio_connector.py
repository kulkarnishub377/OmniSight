"""Audio connector stub for Whisper-style transcription events."""
from datetime import datetime, timezone


def speech_event(source_id='microphone_line_1', text='machine noise increasing') -> dict:
    return {
        'schema_version': '1.0',
        'source_id': source_id,
        'source_type': 'microphone',
        'event_type': 'speech_detected',
        'severity': 'medium',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tenant_id': 'demo_tenant',
        'location': {'site': 'plant_1', 'zone': 'restricted_zone'},
        'payload': {'speaker': 'unknown', 'text': text, 'model': 'whisper'},
        'trace': {'producer': 'audio_connector'},
    }
