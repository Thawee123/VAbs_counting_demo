from __future__ import annotations

import base64
import io
import os
from functools import lru_cache
from typing import Any, Callable

from PIL import Image, ImageOps

from coco_classes import COCO_CLASSES, class_by_id


MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolo11m.pt")
DEFAULT_THRESHOLD = float(os.getenv("YOLO_CONFIDENCE", "0.35"))


def _strip_data_url(image_b64: str) -> str:
    return image_b64.split(",", 1)[1] if "," in image_b64 else image_b64


def decode_image(image_b64: str) -> Image.Image:
    raw = base64.b64decode(_strip_data_url(image_b64))
    image = Image.open(io.BytesIO(raw))
    return ImageOps.exif_transpose(image).convert("RGB")


@lru_cache(maxsize=1)
def get_model():
    from ultralytics import YOLO

    print(f"[VAbs model] loading {MODEL_PATH}", flush=True)
    return YOLO(MODEL_PATH)


def _tolist(value: Any) -> list:
    if hasattr(value, "tolist"):
        return value.tolist()
    return list(value)


def _result_boxes(result: Any) -> tuple[list, list, list]:
    boxes = getattr(result, "obb", None)
    if boxes is None or len(boxes) == 0:
        boxes = getattr(result, "boxes", None)
    if boxes is None or len(boxes) == 0:
        return [], [], []
    return _tolist(boxes.xyxy), _tolist(boxes.conf), _tolist(boxes.cls)


def predict_count(
    image_b64: str,
    target_class_id: int,
    threshold: float | None = None,
    model_loader: Callable[[], Any] = get_model,
) -> dict[str, Any]:
    target = class_by_id(int(target_class_id))
    if target is None:
        return {"success": False, "error": f"Unknown class id {target_class_id}"}

    image = decode_image(image_b64)
    model = model_loader()
    conf = float(threshold if threshold is not None else DEFAULT_THRESHOLD)
    results = model.predict(source=image, conf=conf, verbose=False)
    boxes, confidences, class_ids = _result_boxes(results[0])

    detections = []
    for box, det_conf, class_id in zip(boxes, confidences, class_ids):
        class_id = int(class_id)
        if class_id != target["id"]:
            continue
        x1, y1, x2, y2 = [float(v) for v in box]
        detections.append({
            "classId": class_id,
            "className": target["name"],
            "confidence": round(float(det_conf), 4),
            "x": round((x1 + x2) / 2, 1),
            "y": round((y1 + y2) / 2, 1),
            "x1": round(x1, 1),
            "y1": round(y1, 1),
            "x2": round(x2, 1),
            "y2": round(y2, 1),
        })

    return {
        "success": True,
        "model": "yolo11m",
        "targetClassId": target["id"],
        "targetClassName": target["name"],
        "count": len(detections),
        "detections": detections,
        "sourceWidth": image.width,
        "sourceHeight": image.height,
        "classes": COCO_CLASSES,
    }

