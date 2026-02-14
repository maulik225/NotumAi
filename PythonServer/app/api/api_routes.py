from fastapi import APIRouter, Body, UploadFile, File
from typing import Dict, List, Any
import json
import sqlite3
import cv2
import numpy as np

from app.core.database import get_db_connection
from app.services.ai_service import ai_service
from app.services.export_service import export_service

router = APIRouter()

# --- PROJECT MANAGEMENT ---

@router.get("/projects")
def get_projects():
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT id, name, folder_path, created_at FROM projects ORDER BY created_at DESC")
        return [{"id": r[0], "name": r[1], "path": r[2], "created_at": r[3]} for r in cursor.fetchall()]

@router.post("/projects")
def create_project(data: dict = Body(...)):
    name = data.get("name")
    path = data.get("path")
    
    with get_db_connection() as conn:
        cursor = conn.execute("INSERT INTO projects (name, folder_path) VALUES (?, ?)", (name, path))
        project_id = cursor.lastrowid
        
        default_cats = json.dumps([])
        conn.execute("INSERT INTO project_state (project_id, categories) VALUES (?, ?)", (project_id, default_cats))
        conn.commit()
        
    return {"id": project_id, "name": name, "path": path}

@router.delete("/projects/{project_id}")
def delete_project(project_id: int):
    with get_db_connection() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.execute("DELETE FROM project_state WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM annotations_v2 WHERE project_id = ?", (project_id,))
        conn.commit()
    return {"status": "deleted"}

@router.get("/projects/{project_id}/state")
def get_project_state(project_id: int):
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT last_index, categories, image_paths FROM project_state WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        if row:
            return {
                "lastIndex": row[0],
                "categories": json.loads(row[1]) if row[1] else [],
                "imagePaths": json.loads(row[2]) if row[2] else {}
            }
        return {}

@router.post("/projects/{project_id}/save_state")
def save_project_state(project_id: int, data: dict = Body(...)):
    with get_db_connection() as conn:
        if "lastIndex" in data:
            conn.execute("UPDATE project_state SET last_index = ? WHERE project_id = ?", (data["lastIndex"], project_id))
        if "categories" in data:
            conn.execute("UPDATE project_state SET categories = ? WHERE project_id = ?", (json.dumps(data["categories"]), project_id))
        if "imagePaths" in data:
            conn.execute("UPDATE project_state SET image_paths = ? WHERE project_id = ?", (json.dumps(data["imagePaths"]), project_id))
        conn.commit()
    return {"status": "saved"}

@router.get("/projects/{project_id}/stats")
def get_project_stats(project_id: int):
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT image_paths FROM project_state WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        image_paths = json.loads(row[0]) if row and row[0] else {}
        total_images = len(image_paths)
        
        cursor = conn.execute("SELECT COUNT(*) FROM annotations_v2 WHERE project_id = ?", (project_id,))
        annotated_count = cursor.fetchone()[0]
        
        cursor = conn.execute("SELECT data FROM annotations_v2 WHERE project_id = ?", (project_id,))
        class_dist = {}
        for row in cursor.fetchall():
            annotations = json.loads(row[0]) if row[0] else []
            for ann in annotations:
                cls = ann.get("className", "Unknown")
                class_dist[cls] = class_dist.get(cls, 0) + 1
        
        return {
            "total_images": total_images,
            "annotated_count": annotated_count,
            "class_distribution": class_dist
        }

# --- ANNOTATIONS ---

@router.post("/save_annotation")
def save_annotation(data: dict = Body(...)):
    project_id = data.get("project_id")
    img_name = data.get("image_name")
    annotations_str = json.dumps(data.get("annotations"))
    
    with get_db_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO annotations_v2 (project_id, image_name, data) VALUES (?, ?, ?)", 
                     (project_id, img_name, annotations_str))
        conn.commit()
    return {"status": "success"}

@router.get("/load_annotation")
def load_annotation(project_id: int, image_name: str):
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT data FROM annotations_v2 WHERE project_id = ? AND image_name = ?", (project_id, image_name))
        row = cursor.fetchone()
        return {"annotations": json.loads(row[0]) if row else []}

# --- AI & EXPORT ---

@router.get("/status")
def status():
    return {"status": f"AI_READY ({ai_service.device})"}

@router.post("/load_image_path")
async def load_image_from_path(data: dict = Body(...)):
    path = data.get("path")
    try:
        return await ai_service.load_image_path(path)
    except Exception as e:
        return {"error": str(e)}

@router.post("/segment")
def segment(data: dict = Body(...)):
    return ai_service.segment(data.get("points"))

@router.post("/export")
def export_project_data(data: dict = Body(...)):
    return export_service.export_project(data.get("project_id"), data.get("format"))
