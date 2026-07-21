import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { CLASS_IMAGES } from '../shared/classImages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FRONTEND_DIR = join(ROOT, 'frontend');
const DEFAULT_RAW_DIR = process.env.RAW_DIR || join(ROOT, 'raw');
const DEFAULT_ANNOTATED_DIR = process.env.ANNOTATED_DIR || join(ROOT, 'annotated');
const DEFAULT_MODEL_BASE_URL = process.env.MODEL_BASE_URL || 'http://127.0.0.1:8000';

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(payload));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sanitizeSegment(value) {
  return String(value || 'item').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function extensionFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'png';
}

function decodeImagePayload(image) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(image);
  const mime = match?.[1] || 'image/png';
  const base64 = match?.[2] || image;

  return {
    buffer: Buffer.from(base64, 'base64'),
    dataUrl: `data:${mime};base64,${base64}`,
    mime,
    extension: extensionFromMime(mime),
  };
}

function requestStamp(now = () => new Date(), idGenerator = randomUUID) {
  const time = now().toISOString().replace(/[:.]/g, '-');
  return `${time}-${idGenerator().slice(0, 8)}`;
}

async function saveRawImage({ rawDir, image, targetClassId, targetClassName, stamp }) {
  await mkdir(rawDir, { recursive: true });
  const decoded = decodeImagePayload(image);
  const target = sanitizeSegment(targetClassName || `class-${targetClassId}`);
  const fileName = `${stamp}-${target}.${decoded.extension}`;
  const filePath = join(rawDir, fileName);

  await writeFile(filePath, decoded.buffer);

  return {
    path: filePath,
    fileName,
    dataUrl: decoded.dataUrl,
    mime: decoded.mime,
    bytes: decoded.buffer.length,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAnnotatedSvg({ payload, request, rawRecord }) {
  const width = Math.max(1, Math.round(Number(payload.sourceWidth || 1000)));
  const height = Math.max(1, Math.round(Number(payload.sourceHeight || 1000)));
  const label = escapeXml(`${request.targetClassName || 'target'}: ${payload.count ?? 0}`);
  const detections = Array.isArray(payload.detections) ? payload.detections : [];
  const marks = detections.map((det, index) => {
    const x1 = Number(det.x1 || 0);
    const y1 = Number(det.y1 || 0);
    const x2 = Number(det.x2 || x1);
    const y2 = Number(det.y2 || y1);
    const cx = Number(det.x || (x1 + x2) / 2);
    const cy = Number(det.y || (y1 + y2) / 2);
    const boxWidth = Math.max(1, x2 - x1);
    const boxHeight = Math.max(1, y2 - y1);
    const score = Math.round(Number(det.confidence || 0) * 100);
    return `
      <rect x="${x1}" y="${y1}" width="${boxWidth}" height="${boxHeight}" rx="10" fill="rgba(110,244,243,0.18)" stroke="#6ef4f3" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy}" r="11" fill="#6ef4f3" stroke="#221546" stroke-width="5"/>
      <text x="${x1 + 8}" y="${Math.max(24, y1 - 8)}" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#221546">${index + 1} ${score}%</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <image href="${escapeXml(rawRecord.dataUrl)}" width="${width}" height="${height}" preserveAspectRatio="none"/>
    ${marks}
    <rect x="18" y="18" width="${Math.max(220, label.length * 13)}" height="48" rx="24" fill="#221546" opacity="0.92"/>
    <text x="42" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#6ef4f3">${label}</text>
  </svg>`;
}

async function saveAnnotatedArtifacts({ annotatedDir, payload, request, rawRecord, stamp }) {
  await mkdir(annotatedDir, { recursive: true });
  const jsonFileName = `${stamp}-result.json`;
  const svgFileName = `${stamp}-annotated.svg`;
  const jsonPath = join(annotatedDir, jsonFileName);
  const svgPath = join(annotatedDir, svgFileName);
  const record = {
    createdAt: new Date().toISOString(),
    request,
    raw: {
      path: rawRecord.path,
      fileName: rawRecord.fileName,
      mime: rawRecord.mime,
      bytes: rawRecord.bytes,
    },
    result: payload,
  };

  await writeFile(jsonPath, JSON.stringify(record, null, 2));
  await writeFile(svgPath, buildAnnotatedSvg({ payload, request, rawRecord }));

  return {
    jsonPath,
    svgPath,
    jsonFileName,
    svgFileName,
  };
}

function joinImages(classes) {
  const imageById = new Map(CLASS_IMAGES.map((item) => [item.id, item]));
  return classes.map((item) => ({
    ...item,
    imageUrl: imageById.get(item.id)?.imageUrl || '',
    sourceUrl: imageById.get(item.id)?.sourceUrl || '',
    placeholder: imageById.get(item.id)?.placeholder ?? true,
    style: imageById.get(item.id)?.style || 'cartoon',
  }));
}

async function proxyClasses(modelBaseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${modelBaseUrl.replace(/\/$/, '')}/classes`);
  if (!response.ok) throw new Error(`model /classes ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    classes: joinImages(data.classes || []),
  };
}

async function proxyDetect(modelBaseUrl, body, fetchImpl = fetch) {
  if (!body.image) {
    return { status: 400, payload: { success: false, error: 'image is required' } };
  }
  if (body.targetClassId === undefined || body.targetClassId === null) {
    return { status: 400, payload: { success: false, error: 'targetClassId is required' } };
  }

  const response = await fetchImpl(`${modelBaseUrl.replace(/\/$/, '')}/predict`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      image: body.image,
      targetClassId: Number(body.targetClassId),
      threshold: body.threshold,
    }),
  });
  const payload = await response.json().catch(() => ({ success: false, error: 'invalid model response' }));
  return { status: response.status, payload };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const rawPath = normalize(url.pathname);
  const safePath = normalize(url.pathname === '/' || !extname(rawPath)
    ? '/index.html'
    : url.pathname);
  if (safePath.includes('..')) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }

  const filePath = join(FRONTEND_DIR, safePath);
  const ext = extname(filePath);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };

  try {
    const file = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('content-type', types[ext] || 'application/octet-stream');
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}

export function createBackendServer(options = {}) {
  const modelBaseUrl = options.modelBaseUrl || DEFAULT_MODEL_BASE_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const rawDir = options.rawDir || DEFAULT_RAW_DIR;
  const annotatedDir = options.annotatedDir || DEFAULT_ANNOTATED_DIR;
  const now = options.now || (() => new Date());
  const idGenerator = options.idGenerator || randomUUID;

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
        res.setHeader('access-control-allow-headers', 'content-type');
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') {
        json(res, 200, { status: 'ok', modelBaseUrl, rawDir, annotatedDir, storage: 'local' });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/classes') {
        json(res, 200, await proxyClasses(modelBaseUrl, fetchImpl));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/detect') {
        const body = await readJson(req);
        if (!body.image || body.targetClassId === undefined || body.targetClassId === null) {
          const result = await proxyDetect(modelBaseUrl, body, fetchImpl);
          json(res, result.status, result.payload);
          return;
        }

        const target = CLASS_IMAGES.find((item) => item.id === Number(body.targetClassId));
        const stamp = requestStamp(now, idGenerator);
        const rawRecord = await saveRawImage({
          rawDir,
          image: body.image,
          targetClassId: body.targetClassId,
          targetClassName: target?.name,
          stamp,
        });
        const result = await proxyDetect(modelBaseUrl, body, fetchImpl);
        const annotatedRecord = await saveAnnotatedArtifacts({
          annotatedDir,
          payload: result.payload,
          request: {
            targetClassId: Number(body.targetClassId),
            targetClassName: target?.name || null,
            threshold: body.threshold ?? null,
          },
          rawRecord,
          stamp,
        });

        result.payload.files = {
          raw: rawRecord.path,
          annotatedJson: annotatedRecord.jsonPath,
          annotatedImage: annotatedRecord.svgPath,
        };
        json(res, result.status, result.payload);
        return;
      }

      await serveStatic(req, res);
    } catch (err) {
      json(res, 502, { success: false, error: err instanceof Error ? err.message : 'backend error' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.BACKEND_PORT || 3001);
  createBackendServer().listen(port, () => {
    console.log(`[VAbs backend] http://localhost:${port}`);
  });
}
