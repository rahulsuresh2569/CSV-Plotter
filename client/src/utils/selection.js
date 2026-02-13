// selection.js: Column selection helpers for initial load and name/type overrides

const MAX_AUTO_Y = 4

// Pick default X and Y columns after a successful parse.
// X = first column, Y = first few numeric columns (excluding X).
export function getDefaultSelections(columns) {
  if (columns.length === 0) {
    return { xColumn: null, yColumns: [] }
  }

  const xColumn = columns[0].index

  const yColumns = []
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (col.index === xColumn) continue
    if (col.type !== 'numeric') continue
    yColumns.push(col.index)
    if (yColumns.length >= MAX_AUTO_Y) break
  }

  return { xColumn, yColumns }
}

// Apply custom names and type overrides to the parsed columns array.
// Returns a new array — does not mutate the original.
export function mergeColumnsWithOverrides(columns, columnNames, overriddenColumns) {
  if (!columns) return []

  const merged = []
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const name = columnNames[col.index] ?? col.name

    if (overriddenColumns.has(col.index) && col.type !== 'numeric') {
      merged.push({ ...col, name, type: 'numeric', originalType: col.type })
    } else {
      merged.push({ ...col, name })
    }
  }
  return merged
}
