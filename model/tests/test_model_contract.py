import base64
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from coco_classes import COCO_CLASSES
from model_service import predict_count


def sample_image():
    image = Image.new("RGB", (100, 80), "white")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


class FakeBoxes:
    def __init__(self):
        self.xyxy = SimpleNamespace(tolist=lambda: [[10, 20, 60, 70], [1, 1, 9, 9]])
        self.conf = SimpleNamespace(tolist=lambda: [0.91, 0.44])
        self.cls = SimpleNamespace(tolist=lambda: [39, 0])

    def __len__(self):
        return 2


class FakeModel:
    def predict(self, **kwargs):
        self.kwargs = kwargs
        return [SimpleNamespace(boxes=FakeBoxes(), obb=None)]


class ModelContractTest(unittest.TestCase):
    def test_coco_catalog_is_general_yolo(self):
        self.assertEqual(len(COCO_CLASSES), 80)
        self.assertEqual(COCO_CLASSES[0]["name"], "person")
        self.assertEqual(COCO_CLASSES[39]["name"], "bottle")

    def test_predict_count_filters_to_selected_class(self):
        model = FakeModel()
        result = predict_count(sample_image(), 39, threshold=0.5, model_loader=lambda: model)

        self.assertTrue(result["success"])
        self.assertEqual(result["model"], "yolo11m")
        self.assertEqual(result["targetClassName"], "bottle")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["detections"][0]["classId"], 39)
        self.assertEqual(model.kwargs["conf"], 0.5)


if __name__ == "__main__":
    unittest.main()
