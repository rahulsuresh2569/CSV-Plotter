//api.js: Sends CSV files to the backend for parsing
import axios from 'axios'

const API_BASE = '/api'

export async function uploadCSV(file, overrides = {}) {
  const formData = new FormData()
  formData.append('file', file)

  //only send overrides that aren't 'auto' -backend auto-detects by default
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
