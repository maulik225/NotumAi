import sqlite3
import json
from app.core.config import get_settings

settings = get_settings()

def get_db_connection():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row  # Return dict-like objects
    return conn

def init_db():
    """Initialize the database schema."""
    with get_db_connection() as conn:
        # Projects Table
        conn.execute('''CREATE TABLE IF NOT EXISTS projects (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT,
                        folder_path TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )''')
        
        # Project State (Settings specific to a project)
        conn.execute('''CREATE TABLE IF NOT EXISTS project_state (
                        project_id INTEGER PRIMARY KEY,
                        last_index INTEGER DEFAULT 0,
                        categories TEXT,
                        image_paths TEXT
                    )''')

        # Annotations V2 (Scoped by project)
        conn.execute('''CREATE TABLE IF NOT EXISTS annotations_v2 (
                        project_id INTEGER,
                        image_name TEXT,
                        data TEXT,
                        PRIMARY KEY (project_id, image_name)
                    )''')
        conn.commit()
