import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COCO_CLASSES, classById } from '../shared/cocoClasses.mjs';
import { CLASS_IMAGES } from '../shared/classImages.mjs';

test('COCO class catalog exposes the YOLO11 general model classes', () => {
  assert.equal(COCO_CLASSES.length, 80);
  assert.deepEqual(COCO_CLASSES[0], { id: 0, name: 'person' });
  assert.equal(classById(39).name, 'bottle');
  assert.equal(classById(79).name, 'toothbrush');
});

test('every class has a home-card image record', () => {
  assert.equal(CLASS_IMAGES.length, COCO_CLASSES.length);

  for (const item of CLASS_IMAGES) {
    assert.equal(typeof item.id, 'number');
    assert.equal(typeof item.name, 'string');
    assert.match(item.imageUrl, /^data:image\/svg\+xml/);
    assert.equal(item.placeholder, false);
    assert.equal(item.style, 'cartoon');
    assert.match(item.sourceUrl, /cartoon/);
  }
});
