/**
 * File validation helpers.
 * Runs before CSV parsing to catch obvious problems early.
 */

const VALID_MIMETYPES = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
];

export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file was uploaded.', code: 'NO_FILE' };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty. Please select a CSV file with data.',
      code: 'EMPTY_FILE',
    };
  }

  // Check mimetype and extension — accept if either suggests CSV
  const isValidMimetype = VALID_MIMETYPES.includes(file.mimetype);
  const isValidExtension = file.originalname.toLowerCase().endsWith('.csv');

  if (!isValidMimetype && !isValidExtension) {
    return {
      valid: false,
      error: 'Please upload a file in CSV format (.csv).',
      code: 'INVALID_TYPE',
    };
  }

  // Check if file looks like text (binary files contain null bytes)
  const sample = file.buffer.slice(0, Math.min(1024, file.buffer.length));
  if (sample.includes(0)) {
    return {
      valid: false,
      error: 'This file appears to be binary, not a CSV text file.',
      code: 'BINARY_FILE',
    };
  }

  return { valid: true };
}
