import axios from 'axios'

const API_BASE = '/api'

/**
 * Upload a CSV file to the backend for parsing.
 *
 * @param {File} file - The CSV file from a file input or drag-and-drop
 * @param {{ delimiter?: string, decimal?: string, hasHeader?: string }} overrides
 *   Optional parsing overrides. Values of 'auto' (the default) let the backend
 *   auto-detect. Explicit values like ',' or ';' force a specific setting.
 * @returns {Promise<object>} Parsed result: { columns, data, rowCount, preview, warnings, metadata }
 */
export async function uploadCSV(file, overrides = {}) {
  const formData = new FormData()
  formData.append('file', file)

  // Only send override fields that aren't 'auto' — the backend defaults to
  // auto-detection when a field is absent or equals 'auto'.
  if (overrides.delimiter && overrides.delimiter !== 'auto') {
    formData.append('delimiter', overrides.delimiter)
  }
  if (overrides.decimal && overrides.decimal !== 'auto') {
    formData.append('decimal', overrides.decimal)
  }
  if (overrides.hasHeader && overrides.hasHeader !== 'auto') {
    formData.append('hasHeader', overrides.hasHeader)
  }

  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return response.data
}
