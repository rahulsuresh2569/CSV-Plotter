import { describe, it, expect } from 'vitest';
import { validateFile } from '../utils/validators.js';

// Helper: build a fake file object that mimics what multer provides
function fakeFile(options) {
  const defaults = {
    originalname: 'data.csv',
    mimetype: 'text/csv',
    size: 100,
    buffer: Buffer.from('x,y\n1,2\n3,4'),
  };
  return Object.assign({}, defaults, options);
}

describe('validateFile', function () {

  // --- Missing file ---

  it('returns NO_FILE when file is null', function () {
    const result = validateFile(null);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('NO_FILE');
  });

  it('returns NO_FILE when file is undefined', function () {
    const result = validateFile(undefined);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('NO_FILE');
  });

  // --- Empty file ---

  it('returns EMPTY_FILE when file size is 0', function () {
    const file = fakeFile({ size: 0, buffer: Buffer.alloc(0) });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('EMPTY_FILE');
  });

  // --- MIME type and extension checks ---

  it('rejects when both MIME type and extension are invalid', function () {
    const file = fakeFile({ mimetype: 'image/png', originalname: 'photo.png' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_TYPE');
  });

  it('passes when MIME type is text/csv regardless of extension', function () {
    const file = fakeFile({ mimetype: 'text/csv', originalname: 'data.txt' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('passes when MIME type is text/plain regardless of extension', function () {
    const file = fakeFile({ mimetype: 'text/plain', originalname: 'data.txt' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('passes when MIME type is application/vnd.ms-excel', function () {
    const file = fakeFile({ mimetype: 'application/vnd.ms-excel', originalname: 'report.xls' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('passes when extension is .csv regardless of MIME type', function () {
    const file = fakeFile({ mimetype: 'application/octet-stream', originalname: 'data.csv' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('handles uppercase .CSV extension', function () {
    const file = fakeFile({ mimetype: 'application/octet-stream', originalname: 'DATA.CSV' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  // --- Binary file detection ---

  it('rejects binary files that contain null bytes', function () {
    const binaryContent = Buffer.from([0x48, 0x65, 0x00, 0x6C, 0x6F]);
    const file = fakeFile({ buffer: binaryContent, size: binaryContent.length });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BINARY_FILE');
  });

  it('only checks first 1024 bytes for binary detection', function () {
    // Build a buffer: 1024 clean bytes followed by a null byte
    const clean = Buffer.alloc(1024, 0x41); // 'A' repeated
    const dirty = Buffer.from([0x00]);
    const combined = Buffer.concat([clean, dirty]);
    const file = fakeFile({ buffer: combined, size: combined.length });

    // Null byte is at position 1024 — outside the checked range
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  // --- Valid file ---

  it('passes for a normal CSV buffer', function () {
    const content = Buffer.from('name,age\nAlice,30\nBob,25');
    const file = fakeFile({ buffer: content, size: content.length });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });
});
