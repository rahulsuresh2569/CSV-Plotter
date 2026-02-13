// parser.js: CSV parsing — detects format, parses rows, infers column types
import Papa from 'papaparse';
import { inferColumnTypes } from './inferTypes.js';

export class ParseError extends Error {
  constructor(message, code, metadata = null) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.metadata = metadata;
  }
}

// Separates #-comment lines from data lines.
// Keeps the last comment before data starts — it might be a header (e.g. TestData2).
export function preprocessLines(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');

  let commentHeaderLine = null;
  const dataLines = [];
  let commentLinesSkipped = 0;
  let foundFirstDataLine = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('#')) {
      commentLinesSkipped++;
      if (!foundFirstDataLine) {
        commentHeaderLine = line;
      }
    } else {
      foundFirstDataLine = true;
      dataLines.push(line);
    }
  }

  return { commentHeaderLine, dataLines, commentLinesSkipped };
}

// Counts delimiter candidates across sample lines, picks most consistent one.
// Priority on tie: tab > semicolon > comma
export function autoDetectDelimiter(dataLines) {
  const candidates = ['\t', ';', ','];
  const sampleLines = dataLines.slice(0, Math.min(5, dataLines.length));

  if (sampleLines.length === 0) return ',';

  const results = candidates.map((delim) => {
    const counts = sampleLines.map((line) => {
      let count = 0;
      for (const ch of line) {
        if (ch === delim) count++;
      }
      return count;
    });

    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const isConsistent = minCount === maxCount && minCount > 0;

    return { delim, counts, minCount, maxCount, isConsistent };
  });

  const consistent = results.filter((r) => r.isConsistent);
  if (consistent.length >= 1) {
    return consistent[0].delim;
  }

  const withCounts = results.filter((r) => r.minCount > 0);
  if (withCounts.length > 0) {
    withCounts.sort((a, b) => {
      const varA = a.maxCount - a.minCount;
      const varB = b.maxCount - b.minCount;
      if (varA !== varB) return varA - varB;
      return b.minCount - a.minCount;
    });
    return withCounts[0].delim;
  }

  return ',';
}

// European CSVs use ; delimiter + , decimal. Standard CSVs use . decimal.
export function detectDecimalSeparator(delimiter) {
  if (delimiter === ';') return ',';
  return '.';
}

// Compares the first row's type profile against data rows.
// Mostly-string first row + mostly-numeric data = header.
export function detectHeader(candidateLine, dataLines, delimiter, decimalSep) {
  if (dataLines.length === 0) return true;

  const candidateCells = candidateLine.split(delimiter).map((c) => c.trim());

  let candidateNumericCount = 0;
  for (const cell of candidateCells) {
    if (isNumericCell(cell, decimalSep)) candidateNumericCount++;
  }

  const sampleSize = Math.min(5, dataLines.length);
  let totalDataCells = 0;
  let totalDataNumeric = 0;

  for (let i = 0; i < sampleSize; i++) {
    const cells = dataLines[i].split(delimiter).map((c) => c.trim());
    for (const cell of cells) {
      totalDataCells++;
      if (isNumericCell(cell, decimalSep)) totalDataNumeric++;
    }
  }

  const candidateRatio =
    candidateCells.length > 0
      ? candidateNumericCount / candidateCells.length
      : 0;
  const dataRatio = totalDataCells > 0 ? totalDataNumeric / totalDataCells : 0;

  if (dataRatio > 0.5 && candidateRatio < 0.5) return true;
  if (candidateRatio >= 0.5) return false;
  return true;
}

function isNumericCell(raw, decimalSep) {
  if (!raw || raw.trim() === '') return false;
  const trimmed = raw.trim();
  const normalized = decimalSep === ',' ? trimmed.replaceAll(',', '.') : trimmed;
  const num = Number(normalized);
  return !isNaN(num) && normalized !== '';
}

// Replace decimal commas with dots so Number() works correctly
function normalizeDecimals(rows, decimalSep) {
  if (decimalSep !== ',') return;
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      if (typeof rows[i][j] === 'string') {
        rows[i][j] = rows[i][j].replaceAll(',', '.');
      }
    }
  }
}

// Convert string cells to numbers where possible, empty strings become null
function convertValues(rows) {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      const cell = rows[i][j];
      if (cell === null || cell === undefined) {
        rows[i][j] = null;
        continue;
      }
      const str = String(cell).trim();
      if (str === '') {
        rows[i][j] = null;
        continue;
      }
      const num = Number(str);
      rows[i][j] = !isNaN(num) ? num : str;
    }
  }
}

// Count nulls and unparseable strings per column in a single pass
function collectWarnings(columns, rows) {
  const warnings = [];

  for (const col of columns) {
    let nullCount = 0;
    let stringCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][col.index];
      if (val === null) {
        nullCount++;
      } else if (col.type === 'numeric' && typeof val === 'string') {
        stringCount++;
      }
    }

    if (nullCount > 0) {
      warnings.push({ key: 'warningMissingValues', params: { column: col.name, count: nullCount } });
    }
    if (stringCount > 0) {
      warnings.push({ key: 'warningUnparseable', params: { column: col.name, count: stringCount } });
    }
  }

  return warnings;
}

export function parseCSV(fileBuffer, overrides = {}) {
  const text = fileBuffer.toString('utf-8');
  const warnings = [];

  // Separate comments from data
  const { commentHeaderLine, dataLines, commentLinesSkipped } =
    preprocessLines(text);

  if (dataLines.length === 0) {
    throw new ParseError('The file contains no data rows.', 'NO_DATA');
  }

  // Detect or use overridden delimiter
  const delimiter =
    overrides.delimiter && overrides.delimiter !== 'auto'
      ? overrides.delimiter
      : autoDetectDelimiter(dataLines);

  // Detect or use overridden decimal separator
  const decimalSeparator =
    overrides.decimal && overrides.decimal !== 'auto'
      ? overrides.decimal
      : detectDecimalSeparator(delimiter);

  // Header detection — check if a comment line serves as the header first
  let headerNames;
  let rowLines;
  let hasHeaderDetected;

  let commentIsHeader = false;
  if (commentHeaderLine) {
    const stripped = commentHeaderLine.replace(/^#\s*/, '');
    const commentFields = stripped.split(delimiter).map((h) => h.trim());
    const dataColCount = dataLines[0].split(delimiter).length;

    if (commentFields.length === dataColCount) {
      commentIsHeader = true;
      hasHeaderDetected = true;
      headerNames = commentFields;
      rowLines = dataLines;
    }
  }

  if (!commentIsHeader) {
    if (overrides.hasHeader && overrides.hasHeader !== 'auto') {
      hasHeaderDetected = overrides.hasHeader === 'true';
    } else {
      hasHeaderDetected = detectHeader(
        dataLines[0],
        dataLines.slice(1),
        delimiter,
        decimalSeparator,
      );
    }

    if (hasHeaderDetected) {
      headerNames = dataLines[0].split(delimiter).map((h) => h.trim());
      rowLines = dataLines.slice(1);
    } else {
      const colCount = dataLines[0].split(delimiter).length;
      headerNames = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
      rowLines = dataLines;
    }
  }

  if (rowLines.length === 0) {
    throw new ParseError(
      'The file contains headers but no data rows.',
      'NO_DATA_ROWS',
      { delimiter, decimalSeparator, hasHeader: hasHeaderDetected, commentLinesSkipped },
    );
  }

  // Parse cells with PapaParse
  const csvText = rowLines.join('\n');
  const parseResult = Papa.parse(csvText, {
    delimiter,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    const firstErr = parseResult.errors[0];
    warnings.push({ key: 'warningParseError', params: { row: firstErr.row, message: firstErr.message } });
  }

  let rows = parseResult.data;

  // Filter rows with wrong column count (ragged CSVs)
  const expectedCols = headerNames.length;
  const beforeCount = rows.length;
  rows = rows.filter((row) => row.length === expectedCols);
  if (rows.length < beforeCount) {
    const skipped = beforeCount - rows.length;
    warnings.push({ key: 'warningRaggedRows', params: { count: skipped } });
  }

  // Normalize decimals and convert to numbers (mutates rows in-place)
  normalizeDecimals(rows, decimalSeparator);
  convertValues(rows);

  // Infer column types
  const columns = inferColumnTypes(headerNames, rows);

  if (columns.length < 2) {
    throw new ParseError(
      'Only one column was detected. A chart needs at least two columns (one for X and one for Y).',
      'TOO_FEW_COLUMNS',
      { delimiter, decimalSeparator, hasHeader: hasHeaderDetected, commentLinesSkipped },
    );
  }

  const hasNumeric = columns.some((c) => c.type === 'numeric');
  if (!hasNumeric) {
    warnings.push({ key: 'warningNoNumericColumns' });
  }

  // Collect per-column warnings (missing values, unparseable strings)
  const columnWarnings = collectWarnings(columns, rows);
  for (const w of columnWarnings) {
    warnings.push(w);
  }

  const preview = rows.slice(0, 20);

  return {
    columns,
    data: rows,
    rowCount: rows.length,
    preview,
    warnings,
    metadata: {
      delimiter,
      decimalSeparator,
      hasHeader: hasHeaderDetected,
      commentLinesSkipped,
      originalFileName: null,
    },
  };
}
