// inferTypes.js: Classifies columns as 'numeric', 'date', or 'string' based on values

// Date patterns we check before calling Date.parse() (Date.parse is too permissive on its own)
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  /^\d{2,4}\/\d{2}\/\d{2,4}$/,
  /^\d{2}\.\d{2}\.\d{4}$/,
  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/,
];

function isDateValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;

  const matchesPattern = DATE_PATTERNS.some((re) => re.test(trimmed));
  if (!matchesPattern) return false;

  const ms = Date.parse(trimmed);
  return !isNaN(ms);
}

// Priority: numeric (90% threshold) > date (80%) > string.
// Numeric first because "2026" is a valid number AND a valid date.
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
        type = 'numeric';
      } else if (dateCount / nonNullCount >= 0.8) {
        type = 'date';
      }
    }

    return { name, type, index, numericCount, nonNullCount };
  });
}
