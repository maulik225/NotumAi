import os
import time
import json
import sqlite3
import cv2
import numpy as np
from typing import Dict, Any, List

from app.core.config import get_settings
from app.core.database import get_db_connection

class ExportService:
    def __init__(self):
        self.settings = get_settings()

    def export_project(self, project_id: int, format: str) -> Dict[str, Any]:
        """Export project data to the specified format."""
        
        timestamp = int(time.time())
        base_dir = self.settings.EXPORT_DIR
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)
            
        export_dir = os.path.join(base_dir, f"project_{project_id}_{format}_{timestamp}")
        os.makedirs(export_dir)
        
        try:
            with get_db_connection() as conn:
                # Fetch project data
                cursor = conn.execute("SELECT categories FROM project_state WHERE project_id = ?", (project_id,))
                cat_row = cursor.fetchone()
                categories = json.loads(cat_row[0]) if cat_row and cat_row[0] else []
                cat_map = {c["name"]: i+1 for i, c in enumerate(categories)}

                cursor = conn.execute("SELECT image_name, data FROM annotations_v2 WHERE project_id = ?", (project_id,))
                records = cursor.fetchall()
                
                cursor = conn.execute("SELECT image_paths FROM project_state WHERE project_id = ?", (project_id,))
                path_row = cursor.fetchone()
                image_paths = json.loads(path_row[0]) if path_row and path_row[0] else {}

            if format == 'coco':
                return self._export_coco(export_dir, records, categories, cat_map, image_paths)
            elif format == 'voc':
                return self._export_voc(export_dir, records, image_paths)
            elif format == 'yolo':
                return self._export_yolo(export_dir, records, cat_map, image_paths)
            elif format == 'masks':
                return self._export_masks(export_dir, records, cat_map, image_paths)
            else:
                return {"error": f"Unsupported format: {format}"}

        except Exception as e:
            return {"error": str(e)}

    def _export_coco(self, export_dir, records, categories, cat_map, image_paths):
        coco_data = {
            "info": {"description": "Exported from ProAnnotator", "date_created": time.ctime()},
            "images": [],
            "annotations": [],
            "categories": [{"id": i+1, "name": c["name"]} for i, c in enumerate(categories)]
        }
        
        ann_id = 1
        for img_id, (img_name, ann_json) in enumerate(records, 1):
            width, height = self._get_image_dims(image_paths.get(img_name))
            
            coco_data["images"].append({
                "id": img_id,
                "file_name": img_name,
                "width": width,
                "height": height
            })
            
            anns = json.loads(ann_json)
            for ann in anns:
                cls_name = ann.get("className")
                cat_id = cat_map.get(cls_name, 0)
                points = ann.get("points", [])
                
                if not points: continue
                
                # Validate category
                if cat_id == 0:
                    print(f"Warning: Skipping annotation with unknown class '{cls_name}'")
                    continue

                coco_seg = []
                pts_list = [] # For opencv area
                for p in points:
                    coco_seg.extend([p["x"], p["y"]])
                    pts_list.append([p["x"], p["y"]])
                
                if len(pts_list) < 3: continue # Not a valid polygon

                xs = [p["x"] for p in points]
                ys = [p["y"] for p in points]
                
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                
                # Calculate Polygon Area
                try:
                    poly_np = np.array(pts_list, dtype=np.float32)
                    area = float(cv2.contourArea(poly_np))
                except:
                    area = float((x_max - x_min) * (y_max - y_min)) # Fallback

                coco_data["annotations"].append({
                    "id": ann_id,
                    "image_id": img_id,
                    "category_id": cat_id,
                    "segmentation": [coco_seg],
                    "bbox": [x_min, y_min, x_max - x_min, y_max - y_min],
                    "area": area,
                    "iscrowd": 0
                })
                ann_id += 1
                
        with open(os.path.join(export_dir, "annotations.json"), "w") as f:
            json.dump(coco_data, f, indent=2)
            
        return {"status": "success", "path": export_dir}

    def _export_voc(self, export_dir, records, image_paths):
        import xml.etree.ElementTree as ET
        from xml.dom import minidom
        
        for img_name, ann_json in records:
            anns = json.loads(ann_json)
            if not anns: continue
            
            width, height = self._get_image_dims(image_paths.get(img_name))
            
            root = ET.Element("annotation")
            ET.SubElement(root, "folder").text = "images"
            ET.SubElement(root, "filename").text = img_name
            
            size = ET.SubElement(root, "size")
            ET.SubElement(size, "width").text = str(width)
            ET.SubElement(size, "height").text = str(height)
            ET.SubElement(size, "depth").text = "3"

            for ann in anns:
                obj = ET.SubElement(root, "object")
                ET.SubElement(obj, "name").text = ann.get("className", "unknown")
                ET.SubElement(obj, "pose").text = "Unspecified"
                ET.SubElement(obj, "truncated").text = "0"
                ET.SubElement(obj, "difficult").text = "0"
                
                points = ann.get("points", [])
                if points:
                    xs = [p["x"] for p in points]
                    ys = [p["y"] for p in points]
                    bndbox = ET.SubElement(obj, "bndbox")
                    ET.SubElement(bndbox, "xmin").text = str(min(xs))
                    ET.SubElement(bndbox, "ymin").text = str(min(ys))
                    ET.SubElement(bndbox, "xmax").text = str(max(xs))
                    ET.SubElement(bndbox, "ymax").text = str(max(ys))
            
            xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")
            out_name = os.path.splitext(img_name)[0] + ".xml"
            with open(os.path.join(export_dir, out_name), "w") as f:
                f.write(xml_str)
                
        return {"status": "success", "path": export_dir}

    def _export_yolo(self, export_dir, records, cat_map, image_paths):
        for img_name, ann_json in records:
            anns = json.loads(ann_json)
            if not anns: continue
            
            width, height = self._get_image_dims(image_paths.get(img_name))
            
            lines = []
            for ann in anns:
                cls_name = ann.get("className")
                cat_id = cat_map.get(cls_name)
                if cat_id is None: continue
                class_idx = cat_id - 1
                
                points = ann.get("points", [])
                if points:
                    xs = [p["x"] for p in points]
                    ys = [p["y"] for p in points]
                    x_min, x_max = min(xs), max(xs)
                    y_min, y_max = min(ys), max(ys)
                    
                    if width == 0 or height == 0: continue

                    dw = 1.0 / width
                    dh = 1.0 / height
                    x_center = (x_min + x_max) / 2.0 * dw
                    y_center = (y_min + y_max) / 2.0 * dh
                    w = (x_max - x_min) * dw
                    h = (y_max - y_min) * dh
                    
                    lines.append(f"{class_idx} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}")
            
            if lines:
                out_name = os.path.splitext(img_name)[0] + ".txt"
                with open(os.path.join(export_dir, out_name), "w") as f:
                    f.write("\n".join(lines))
                    
        return {"status": "success", "path": export_dir}

    def _export_masks(self, export_dir, records, cat_map, image_paths):
        for img_name, ann_json in records:
            anns = json.loads(ann_json)
            width, height = self._get_image_dims(image_paths.get(img_name))
            
            mask = np.zeros((height, width), dtype=np.uint8)
            
            for ann in anns:
                cls_name = ann.get("className")
                cat_id = cat_map.get(cls_name, 0)
                points = ann.get("points", [])
                if points:
                    pts = np.array([[p["x"], p["y"]] for p in points], np.int32)
                    pts = pts.reshape((-1, 1, 2))
                    cv2.fillPoly(mask, [pts], int(cat_id))

            out_name = os.path.splitext(img_name)[0] + ".png"
            cv2.imwrite(os.path.join(export_dir, out_name), mask)
            
        return {"status": "success", "path": export_dir}

    def _get_image_dims(self, path):
        if path and os.path.exists(path):
            try:
                img = cv2.imread(path)
                if img is not None:
                    return img.shape[1], img.shape[0] # w, h
            except: pass
        return 800, 600

export_service = ExportService()
