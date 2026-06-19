import json
from datetime import datetime
from typing import Any


def dumps(value: Any) -> str:
    return json.dumps(value, default=lambda x: x.isoformat() if isinstance(x, datetime) else str(x))


def loads(value: str | None, default: Any):
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default
