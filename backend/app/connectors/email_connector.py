"""Email connector placeholder.

Production implementation would poll IMAP/Gmail/Microsoft Graph and normalize
messages into document or alert events.
"""

def normalize_email(subject: str, body: str) -> dict:
    return {
        'source_id': 'email_inbox_ops',
        'source_type': 'email',
        'event_type': 'email_received',
        'severity': 'low',
        'payload': {'subject': subject, 'body': body},
        'trace': {'producer': 'email_connector'},
    }
