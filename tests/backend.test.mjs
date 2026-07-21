import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';

import { createBackendServer } from '../backend/server.mjs';

async function invoke(server, method, url, body) {
  const chunks = [];
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;

  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.headers = {};
  res.statusCode = 200;
  res.setHeader = (key, value) => {
    res.headers[key.toLowerCase()] = value;
  };
  const originalEnd = res.end.bind(res);
  res.end = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.from(chunk));
    originalEnd(undefined, encoding, callback);
  };

  await server.listeners('request')[0](req, res);
  await once(res, 'finish');
  const text = Buffer.concat(chunks).toString('utf8');
  return { status: res.statusCode, text, body: text ? JSON.parse(text) : null };
}

test('backend joins model classes with home-card image metadata', async () => {
  const backend = createBackendServer({
    modelBaseUrl: 'http://model.local',
    fetchImpl: async (url) => {
      assert.equal(url, 'http://model.local/classes');
      return Response.json({ model: 'yolo11m', classes: [{ id: 39, name: 'bottle' }] });
    },
  });

  const response = await invoke(backend, 'GET', '/api/classes');
  assert.equal(response.status, 200);
    assert.equal(response.body.model, 'yolo11m');
    assert.equal(response.body.classes[0].id, 39);
    assert.match(response.body.classes[0].imageUrl, /^data:image\/svg\+xml/);
    assert.equal(response.body.classes[0].style, 'cartoon');
  });

test('backend validates and proxies class-targeted detection', async () => {
  let proxiedBody = null;
  const backend = createBackendServer({
    modelBaseUrl: 'http://model.local',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'http://model.local/predict');
      proxiedBody = JSON.parse(options.body);
      return Response.json({ success: true, targetClassId: 39, count: 1, detections: [] });
    },
  });

  const missing = await invoke(backend, 'POST', '/api/detect', { targetClassId: 39 });
  assert.equal(missing.status, 400);

  const response = await invoke(backend, 'POST', '/api/detect', {
    image: 'data:image/png;base64,abc',
    targetClassId: 39,
    threshold: 0.5,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.count, 1);
  assert.deepEqual(proxiedBody, {
    image: 'data:image/png;base64,abc',
    targetClassId: 39,
    threshold: 0.5,
  });
});

test('backend stores raw images and annotated results on the local PC', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vabs-local-storage-'));
  const rawDir = join(root, 'raw');
  const annotatedDir = join(root, 'annotated');
  const image = `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`;
  const backend = createBackendServer({
    modelBaseUrl: 'http://model.local',
    rawDir,
    annotatedDir,
    now: () => new Date('2026-07-02T08:00:00.000Z'),
    idGenerator: () => 'abcdef123456',
    fetchImpl: async () => Response.json({
      success: true,
      targetClassId: 39,
      targetClassName: 'bottle',
      count: 2,
      sourceWidth: 100,
      sourceHeight: 80,
      detections: [{ x1: 10, y1: 20, x2: 60, y2: 70, x: 35, y: 45, confidence: 0.91 }],
    }),
  });

  const response = await invoke(backend, 'POST', '/api/detect', {
    image,
    targetClassId: 39,
  });

  assert.equal(response.status, 200);
  assert.match(response.body.files.raw, /raw\/2026-07-02T08-00-00-000Z-abcdef12-bottle\.png$/);
  assert.match(response.body.files.annotatedJson, /annotated\/2026-07-02T08-00-00-000Z-abcdef12-result\.json$/);
  assert.match(response.body.files.annotatedImage, /annotated\/2026-07-02T08-00-00-000Z-abcdef12-annotated\.svg$/);

  const rawFiles = await readdir(rawDir);
  const annotatedFiles = (await readdir(annotatedDir)).sort();
  assert.deepEqual(rawFiles, ['2026-07-02T08-00-00-000Z-abcdef12-bottle.png']);
  assert.deepEqual(annotatedFiles, [
    '2026-07-02T08-00-00-000Z-abcdef12-annotated.svg',
    '2026-07-02T08-00-00-000Z-abcdef12-result.json',
  ]);

  const output = JSON.parse(await readFile(join(annotatedDir, '2026-07-02T08-00-00-000Z-abcdef12-result.json'), 'utf8'));
  assert.equal(output.request.targetClassName, 'bottle');
  assert.equal(output.result.count, 2);

  const svg = await readFile(join(annotatedDir, '2026-07-02T08-00-00-000Z-abcdef12-annotated.svg'), 'utf8');
  assert.match(svg, /<image href="data:image\/png;base64/);
  assert.match(svg, /<rect x="10" y="20" width="50" height="50"/);
  assert.match(svg, /<circle cx="35" cy="45"/);
});
