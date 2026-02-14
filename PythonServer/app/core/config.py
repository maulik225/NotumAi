import os
from functools import lru_cache

class Settings:
    PROJECT_NAME: str = "Pro Annotator v6 (Google Design Edition)"
    API_V1_STR: str = "/api/v1"
    
    # Paths
    # robustly determine base dir
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ROOT_DIR = os.path.dirname(BASE_DIR)
    
    CHECKPOINT_PATH: str = os.path.join(ROOT_DIR, "checkpoints", "sam2.1_hiera_small.pt")
    MODEL_CONFIG_PATH: str = os.path.join(ROOT_DIR, "configs", "sam2.1", "sam2.1_hiera_s.yaml")
    DB_PATH: str = os.path.join(ROOT_DIR, "project_data.db")
    MASK_DIR: str = os.path.join(ROOT_DIR, "masks")
    EXPORT_DIR: str = os.path.join(ROOT_DIR, "exports")

    # AI Config
    MAX_IMAGE_SIZE: int = 1024
    DEVICE: str = "cuda"  # Will be auto-detected in service

@lru_cache()
def get_settings():
    return Settings()
