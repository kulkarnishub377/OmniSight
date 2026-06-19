from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    app_name: str = 'AMIF'
    env: str = 'dev'
    secret_key: str = 'change-me-in-production'
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 480

    database_url: str = 'sqlite:///./amif.db'
    sqlite_database_url: str = 'sqlite:///./amif.db'
    redis_url: str = 'redis://localhost:6379/0'
    qdrant_url: str = 'http://localhost:6333'

    admin_email: str = 'admin@example.com'
    admin_password: str = 'admin123'
    cors_origins: List[str] | str = ['http://localhost:8000', 'http://localhost:3000']

    @field_validator('cors_origins')
    @classmethod
    def parse_cors(cls, value):
        if isinstance(value, str):
            return [v.strip() for v in value.split(',') if v.strip()]
        return value

    @property
    def effective_database_url(self) -> str:
        return self.database_url or self.sqlite_database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
