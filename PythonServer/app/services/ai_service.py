import torch
import numpy as np
import cv2
import os
import hashlib
from typing import List, Dict, Any, Optional
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

from app.core.config import get_settings

class AIService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
            cls._instance.initialize()
        return cls._instance
    
    def initialize(self):
        settings = get_settings()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.checkpoint = settings.CHECKPOINT_PATH
        self.model_cfg = settings.MODEL_CONFIG_PATH
        self.embedding_cache = {}
        self.max_cache_size = 10
        self.predictor: Optional[SAM2ImagePredictor] = None
        
        # Initialize
        print(f"Loading SAM2 model from {self.checkpoint} on {self.device}...")
        try:
            sam2_model = build_sam2(self.model_cfg, self.checkpoint, device=self.device)
            self.predictor = SAM2ImagePredictor(sam2_model)
            print("SAM2 Model loaded successfully.")
        except Exception as e:
            print(f"Failed to load SAM2 model: {e}")

    def get_image_hash(self, image_bytes: bytes) -> str:
        return hashlib.md5(image_bytes).hexdigest()

    def cache_embedding(self, img_hash: str, features, orig_hw):
        """Limit cache size with LRU."""
        if len(self.embedding_cache) >= self.max_cache_size:
            oldest = next(iter(self.embedding_cache))
            del self.embedding_cache[oldest]
        self.embedding_cache[img_hash] = {"features": features, "orig_hw": orig_hw}

    async def load_image_path(self, path: str) -> Dict[str, Any]:
        """Load image from path, resize, cache embedding."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image not found at {path}")
            
        settings = get_settings()
        
        with open(path, "rb") as f:
            image_bytes = f.read()

        img_hash = self.get_image_hash(image_bytes)
        
        # Check cache (disabled temporarily as per original logic if needed, but here we can try enabling if stable)
        # For now, let's keep the caching explicit logic from main.py but wrapped in service
        
        np_img = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        h, w = image.shape[:2]
        
        if max(h, w) > settings.MAX_IMAGE_SIZE:
            scale = settings.MAX_IMAGE_SIZE / max(h, w)
            image = cv2.resize(image, (int(w * scale), int(h * scale)))
            
        if self.predictor:
            self.predictor.set_image(image)
            self.cache_embedding(img_hash, self.predictor._features, self.predictor._orig_hw)
            
        return {"message": "Image encoded", "width": w, "height": h}

    def segment(self, points: List[Dict[str, int]]) -> Dict[str, Any]:
        if not points:
            return {"polygon": [], "error": "No points provided"}
            
        if not self.predictor or not getattr(self.predictor, "_is_image_set", False):
             return {"polygon": [], "error": "Image not set in predictor"}

        input_points = np.array([[p["x"], p["y"]] for p in points])
        input_labels = np.array([1] * len(points)) # 1 = foreground

        masks, scores, _ = self.predictor.predict(
            point_coords=input_points,
            point_labels=input_labels,
            multimask_output=False
        )
        
        mask_bin = (masks[0] * 255).astype(np.uint8)
        contours, _ = cv2.findContours(mask_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        polygon = []
        if contours:
            main_contour = max(contours, key=cv2.contourArea)
            epsilon = 0.002 * cv2.arcLength(main_contour, True)
            approx = cv2.approxPolyDP(main_contour, epsilon, True)
            polygon = [{"x": int(p[0][0]), "y": int(p[0][1])} for p in approx]
            
        return {"polygon": polygon, "score": float(scores[0])}
        
ai_service = AIService()
