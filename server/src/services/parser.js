/**
 * CSV parsing pipeline.
 *
 * Pipeline:
 *   raw text
 *     → preprocessLines    (separate comments from data, find header candidate)
 *     → autoDetectDelimiter (count ; , \t across sample lines)
 *     → detectDecimalSep    (infer from delimiter)
 *     → detectHeader        (compare first-row type profile to data rows)
 *     → PapaParse           (split cells by delimiter)
 *     → normalizeDecimals   (replace decimal commas with dots)
 *     → convertValues       (string → number where possible)
 *     → inferColumnTypes    (classify each column)
 *     → buildResponse
 */

import Papa from 'papaparse';
import { inferColumnTypes } from './inferTypes.js';

// ---------------------------------------------------------------------------
// Custom error class so the route handler can distinguish parse errors
// ---------------------------------------------------------------------------
export class ParseError extends Error {
  constructor(message, code, metadata = null) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.metadata = metadata;
  }
}

// ---------------------------------------------------------------------------
// 1. preprocessLines
//    Separates #-comment lines from data lines.
//    Finds the last comment line before data starts (potential header for
//    files like TestData2 where the header is #-prefixed).
// ---------------------------------------------------------------------------
export function preprocessLines(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');

  let commentHeaderLine = null; // last # line before first data line
  const dataLines = [];
  let commentLinesSkipped = 0;
  let foundFirstDataLine = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('#')) {
      commentLinesSkipped++;
      if (!foundFirstDataLine) {
        // Keep overwriting — we want the LAST comment before data
        commentHeaderLine = line;
      }
      // Comments after data (e.g. #TEST-DATA-END) are simply skipped
    } else {
      foundFirstDataLine = true;
      dataLines.push(line);
    }
  }

  return { commentHeaderLine, dataLines, commentLinesSkipped };
}

// ---------------------------------------------------------------------------
// 2. autoDetectDelimiter
//    Counts occurrences of candidate delimiters across sample lines.
//    Picks the one with the most consistent non-zero count.
//    Priority on tie: tab > semicolon > comma  (tab is rarest in values,
//    semicolon indicates European CSV which needs special decimal handling).
// ---------------------------------------------------------------------------
export function autoDetectDelimiter(dataLines) {
  const candidates = ['\t', ';', ',']; // priority order
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

  // First choice: a perfectly consistent delimiter
  const consistent = results.filter((r) => r.isConsistent);
  if (consistent.length >= 1) {
    // If there's a tie, priority order (tab > ; > ,) breaks it
    return consistent[0].delim;
  }

  // Second choice: the delimiter with highest minimum count (appears in every line)
  const withCounts = results.filter((r) => r.minCount > 0);
  if (withCounts.length > 0) {
    withCounts.sort((a, b) => {
      const varA = a.maxCount - a.minCount;
      const varB = b.maxCount - b.minCount;
      if (varA !== varB) return varA - varB; // prefer less variance
      return b.minCount - a.minCount; // then higher count
    });
    return withCounts[0].delim;
  }

  return ','; // fallback
}

// ---------------------------------------------------------------------------
// 3. detectDecimalSeparator
//    Simple heuristic: European CSVs use ; delimiter + , decimal.
//    Standard CSVs use , delimiter + . decimal.
// ---------------------------------------------------------------------------
export function detectDecimalSeparator(delimiter) {
  if (delimiter === ';') return ',';
  return '.';
}

// ---------------------------------------------------------------------------
// 4. detectHeader
//    Compares the first-row type profile against a sample of data rows.
//    If the first row is mostly non-numeric while data is mostly numeric,
//    it's a header.  If both look similar → no header.
// ---------------------------------------------------------------------------
export function detectHeader(candidateLine, dataLines, delimiter, decimalSep) {
  if (dataLines.length === 0) return true; // only one line → treat as header

  const candidateCells = candidateLine.split(delimiter).map((c) => c.trim());

  // Count numeric cells in candidate
  const candidateNumericCount = candidateCells.filter((cell) =>
    isNumericCell(cell, decimalSep),
  ).length;

  // Count numeric cells in a sample of data lines
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

  // Mostly-string first row + mostly-numeric data → header
  if (dataRatio > 0.5 && candidateRatio < 0.5) return true;

  // First row is similarly numeric to data → not a header (it's data)
  if (candidateRatio >= 0.5) return false;

  // Both non-numeric (all strings) → default: treat first row as header
  return true;
}

/** Helper: checks if a raw cell string looks like a number */
function isNumericCell(raw, decimalSep) {
  if (!raw || raw.trim() === '') return false;
  const trimmed = raw.trim();
  const normalized = decimalSep === ',' ? trimmed.replaceAll(',', '.') : trimmed;
  const num = Number(normalized);
  return !isNaN(num) && normalized !== '';
}

// ---------------------------------------------------------------------------
// 5. Main pipeline — parseCSV
// ---------------------------------------------------------------------------

/**
 * @param {Buffer} fileBuffer
 * @param {{ delimiter?: string, decimal?: string, hasHeader?: string }} overrides
 * @returns {object} Structured parse result
 */
export function parseCSV(fileBuffer, overrides = {}) {
  const text = fileBuffer.toString('utf-8');
  const warnings = [];

  // --- Step 1: separate comments from data --------------------------------
  const { commentHeaderLine, dataLines, commentLinesSkipped } =
    preprocessLines(text);

  if (dataLines.length === 0) {
    throw new ParseError(
      'The file contains no data rows.',
      'NO_DATA',
    );
  }

  // --- Step 2: delimiter ---------------------------------------------------
  const delimiter =
    overrides.delimiter && overrides.delimiter !== 'auto'
      ? overrides.delimiter
      : autoDetectDelimiter(dataLines);

  // --- Step 3: decimal separator -------------------------------------------
  const decimalSeparator =
    overrides.decimal && overrides.decimal !== 'auto'
      ? overrides.decimal
      : detectDecimalSeparator(delimiter);

  // --- Step 4: header detection -------------------------------------------
  let headerNames;
  let rowLines; // the lines that contain actual data (header excluded)
  let hasHeaderDetected;

  // Check if the last comment line is actually a header for the data.
  // It qualifies only if its field count matches the data's column count
  // (e.g. TestData2: "#Point Nr.; Freq.;FRFMag;FRFPhase" → 4 fields, data has 4 cols).
  // If it doesn't match, it's just metadata — fall through to normal detection.
  let commentIsHeader = false;
  if (commentHeaderLine) {
    const stripped = commentHeaderLine.replace(/^#\s*/, '');
    const commentFields = stripped.split(delimiter).map((h) => h.trim());
    const dataColCount = dataLines[0].split(delimiter).length;

    if (commentFields.length === dataColCount) {
      commentIsHeader = true;
      hasHeaderDetected = true;
      headerNames = commentFields;
      rowLines = dataLines; // all non-comment lines are data
    }
  }

  if (!commentIsHeader) {
    // Decide whether the first data line is a header or not
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
      // No header → generate Column 1, Column 2, …
      const colCount = dataLines[0].split(delimiter).length;
      headerNames = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
      rowLines = dataLines; // first line is data
    }
  }

  if (rowLines.length === 0) {
    throw new ParseError(
      'The file contains headers but no data rows.',
      'NO_DATA_ROWS',
      { delimiter, decimalSeparator, hasHeader: hasHeaderDetected, commentLinesSkipped },
    );
  }

  // --- Step 5: parse with PapaParse ----------------------------------------
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

  // --- Step 6: normalise decimals ------------------------------------------
  if (decimalSeparator === ',') {
    rows = rows.map((row) =>
      row.map((cell) =>
        typeof cell === 'string' ? cell.replaceAll(',', '.') : cell,
      ),
    );
  }

  // --- Step 7: convert strings to numbers where possible -------------------
  rows = rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return null;
      const str = String(cell).trim();
      if (str === '') return null;
      const num = Number(str);
      return !isNaN(num) ? num : str;
    }),
  );

  // --- Step 8: infer column types ------------------------------------------
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

  // Report missing values per column
  for (const col of columns) {
    const nullCount = rows.filter((row) => row[col.index] === null).length;
    if (nullCount > 0) {
      warnings.push({ key: 'warningMissingValues', params: { column: col.name, count: nullCount } });
    }
  }

  // Report non-numeric (string) values in numeric columns
  for (const col of columns) {
    if (col.type !== 'numeric') continue;
    const stringCount = rows.filter((row) => {
      const val = row[col.index];
      return val !== null && typeof val === 'string';
    }).length;
    if (stringCount > 0) {
      warnings.push({ key: 'warningUnparseable', params: { column: col.name, count: stringCount } });
    }
  }

  // --- Step 9: build response ----------------------------------------------
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
      originalFileName: null, // set by the route handler
    },
  };
}
