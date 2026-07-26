import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPhotoExif } from '../../server/services/photo-exif-service.mjs';
import { exifJpegFixture } from '../fixtures/exif-jpeg.mjs';

test('JPEG EXIF extracts capture time and WGS84 GPS without inventing timezone', () => {
  const exif = extractPhotoExif(exifJpegFixture(), 'image/jpeg');
  assert.equal(exif.found, true);
  assert.equal(exif.capturedAt, '2026-07-26T12:34:56');
  assert.equal(exif.capturedAtOriginal, '2026:07:26 12:34:56');
  assert.equal(exif.timezoneStatus, 'unknown');
  assert.ok(Math.abs(exif.coordinates[0] - 108.95) < 1e-10);
  assert.ok(Math.abs(exif.coordinates[1] - 34.27) < 1e-10);
  assert.equal(exif.coordinateCrs, 'WGS84');
});

test('unsupported or invalid image never produces fallback EXIF values', () => {
  assert.deepEqual(extractPhotoExif(Buffer.from('not-a-photo'), 'image/png').coordinates, null);
  const invalid = extractPhotoExif(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg');
  assert.equal(invalid.found, false);
  assert.equal(invalid.coordinates, null);
  assert.equal(invalid.capturedAt, null);
});
