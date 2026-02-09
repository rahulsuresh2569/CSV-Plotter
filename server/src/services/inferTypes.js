/**
 * Column type inference.
 * Classifies each column as 'numeric' or 'string' based on its values.
 */

/**
 * @param {string[]} headerNames - Column names
 * @param {Array<Array<number|string|null>>} rows - Parsed data rows (values already converted)
 * @returns {Array<{name: string, type: string, index: number}>}
 */
export function inferColumnTypes(headerNames, rows) {
  return headerNames.map((name, index) => {
    let numericCount = 0;
    let nonNullCount = 0;

    for (const row of rows) {
      const value = row[index];
      if (value === null || value === undefined) continue;
      nonNullCount++;
      if (typeof value === 'number' && isFinite(value)) {
        numericCount++;
      }
    }

    // A column is numeric if >=90% of its non-null values are numbers.
    // The threshold allows for occasional stray values.
    const type =
      nonNullCount > 0 && numericCount / nonNullCount >= 0.9
        ? 'numeric'
        : 'string';

    return { name, type, index };
  });
}
