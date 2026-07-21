# VAbs Solution

Local visual counting app for YOLO11m.

## Run

```bash
npm run dev
```

Open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/health
- Model API: http://localhost:8000/health

The first detection loads `yolo11m.pt`. If the weight file is not present, Ultralytics downloads it.

Local files are kept on this PC:

- Original uploaded/captured images: `raw/`
- Annotated detection artifacts: `annotated/`

There is no S3 or MongoDB integration in this version.

## Test

```bash
npm test
```

## Flow

- `/home` lists all 80 YOLO classes as product cards.
- Select a class to target the detector.
- Upload a file or take a picture.
- The model returns only detections for the selected class.
- `/sku` is intentionally skipped.
