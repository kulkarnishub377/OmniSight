from pydantic import BaseModel, Field
from typing import List, Dict, Any

class PlaybookStep(BaseModel):
    step_id: str
    action_type: str = Field(..., description="E.g., slack_alert, webhook_trigger, wait_for_ack")
    payload: Dict[str, Any]
    retry_count: int = 0
    max_retries: int = 3

class Playbook(BaseModel):
    incident_id: str
    steps: List[PlaybookStep]
    status: str = Field("PENDING", description="PENDING, RUNNING, COMPLETED, FAILED")
