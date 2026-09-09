from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    auth_token: str
    hf_token: str = ""
    hf_dataset_repo: str = ""
    allowed_origins: str = "http://localhost:3000"
    data_dir: str = "data"
    flush_interval_seconds: float = 8.0
    flush_batch_size: int = 5

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
