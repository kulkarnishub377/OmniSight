from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "OmniSight Enterprise"
    API_V1_STR: str = "/api/v1"
    
    # Kafka / Redpanda Config
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_RAW_EVENTS_TOPIC: str = "raw.events"
    KAFKA_DLQ_TOPIC: str = "dlq.events"
    
    # Neo4j Config
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "omnisight_secure_pass"
    
    # Qdrant Config
    QDRANT_URL: str = "http://localhost:6333"
    
    # Redis Config
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security Config
    API_KEY_ROTATION_SECRET: str = "super_secret_rotation_key"
    MTLS_ENABLED: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
