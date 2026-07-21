from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from coco_classes import COCO_CLASSES
from model_service import MODEL_PATH, predict_count


app = FastAPI(title="VAbs Local YOLO11m")


class PredictRequest(BaseModel):
    image: str
    targetClassId: int
    threshold: float | None = None


@app.get("/health")
def health():
    return {"status": "healthy", "model": "yolo11m", "weights": MODEL_PATH}


@app.get("/classes")
def classes():
    return {"model": "yolo11m", "classes": COCO_CLASSES}


@app.post("/predict")
def predict(req: PredictRequest):
    return predict_count(req.image, req.targetClassId, req.threshold)

