/**
 * Column type inference.
 * Classifies each column as 'numeric', 'date', or 'string' based on its values.
 *
 * Priority: numeric (90% threshold) → date (80% threshold) → string.
 * Numeric is checked first because values like "2026" are valid numbers AND
 * valid dates — we want those treated as numbers unless the column clearly
 * contains date-formatted strings.
 */

// Regex patterns that identify common date/datetime formats.
// We require these patterns BEFORE calling Date.parse(), because Date.parse()
// is too permissive (e.g. Date.parse("1") is valid on some engines).
const DATE_PATTERNS = [
  // ISO 8601: 2026-02-01, 2026-02-01T08:00:00, 2026-02-01T08:00:00Z, 2026-02-01T08:00:00+01:00
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  // Slash-separated: 2026/02/01, 02/01/2026
  /^\d{2,4}\/\d{2}\/\d{2,4}$/,
  // Dot-separated (European): 01.02.2026
  /^\d{2}\.\d{2}\.\d{4}$/,
  // Space-separated datetime: 2026-02-01 08:00:00
  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/,
];

/**
 * Check if a string value looks like a date/datetime.
 * Must match a known pattern AND produce a valid Date.
 */
function isDateValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;

  const matchesPattern = DATE_PATTERNS.some((re) => re.test(trimmed));
  if (!matchesPattern) return false;

  const ms = Date.parse(trimmed);
  return !isNaN(ms);
}

/**
 * @param {string[]} headerNames - Column names
 * @param {Array<Array<number|string|null>>} rows - Parsed data rows (values already converted)
 * @returns {Array<{name: string, type: string, index: number}>}
 */
export function inferColumnTypes(headerNames, rows) {
  return headerNames.map((name, index) => {
    let numericCount = 0;
    let dateCount = 0;
    let nonNullCount = 0;

    for (const row of rows) {
      const value = row[index];
      if (value === null || value === undefined) continue;
      nonNullCount++;
      if (typeof value === 'number' && isFinite(value)) {
        numericCount++;
      } else if (isDateValue(value)) {
        dateCount++;
      }
    }

    let type = 'string';
    if (nonNullCount > 0) {
      if (numericCount / nonNullCount >= 0.9) {
        // Numeric takes priority (90% threshold)
        type = 'numeric';
      } else if (dateCount / nonNullCount >= 0.8) {
        // Date detection (80% threshold — slightly more lenient since
        // date columns sometimes have a stray label or note)
        type = 'date';
      }
    }

    return { name, type, index, numericCount, nonNullCount };
  });
}
