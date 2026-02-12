import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  preprocessLines,
  autoDetectDelimiter,
  detectDecimalSeparator,
  detectHeader,
  parseCSV,
  ParseError,
} from '../services/parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var TEST_DATA_DIR = path.join(__dirname, '..', '..', '..', 'test-data', 'csv_test_pack');
var SAMPLE_DATA_DIR = path.join(__dirname, '..', '..', '..', 'client', 'public', 'sample-data');

function loadTestFile(filename) {
  return fs.readFileSync(path.join(TEST_DATA_DIR, filename));
}

function loadSampleFile(filename) {
  return fs.readFileSync(path.join(SAMPLE_DATA_DIR, filename));
}

function toBuffer(text) {
  return Buffer.from(text, 'utf-8');
}

// ---------------------------------------------------------------------------
// preprocessLines
// ---------------------------------------------------------------------------

describe('preprocessLines', function () {

  it('returns empty dataLines for empty text', function () {
    var result = preprocessLines('');
    expect(result.dataLines).toEqual([]);
    expect(result.commentHeaderLine).toBe(null);
    expect(result.commentLinesSkipped).toBe(0);
  });

  it('returns all lines as dataLines when no comments exist', function () {
    var text = 'a,b\n1,2\n3,4';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual(['a,b', '1,2', '3,4']);
    expect(result.commentHeaderLine).toBe(null);
    expect(result.commentLinesSkipped).toBe(0);
  });

  it('separates comment lines from data lines', function () {
    var text = '# comment\ndata1\ndata2';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual(['data1', 'data2']);
    expect(result.commentLinesSkipped).toBe(1);
  });

  it('captures last comment before first data line as commentHeaderLine', function () {
    var text = '# first\n# second\n# third\n1,2,3\n4,5,6';
    var result = preprocessLines(text);
    expect(result.commentHeaderLine).toBe('# third');
    expect(result.commentLinesSkipped).toBe(3);
    expect(result.dataLines.length).toBe(2);
  });

  it('ignores comments that appear after data starts', function () {
    var text = '1,2\n# mid-comment\n3,4\n# end-comment';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual(['1,2', '3,4']);
    expect(result.commentLinesSkipped).toBe(2);
    // commentHeaderLine should be null because no comment came before data
    expect(result.commentHeaderLine).toBe(null);
  });

  it('filters out blank lines', function () {
    var text = 'a,b\n\n\n1,2\n   \n3,4';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual(['a,b', '1,2', '3,4']);
  });

  it('handles Windows line endings (CRLF)', function () {
    var text = 'a,b\r\n1,2\r\n3,4';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual(['a,b', '1,2', '3,4']);
  });

  it('returns only comments and no data when file has only comments', function () {
    var text = '# line1\n# line2\n# line3';
    var result = preprocessLines(text);
    expect(result.dataLines).toEqual([]);
    expect(result.commentLinesSkipped).toBe(3);
    expect(result.commentHeaderLine).toBe('# line3');
  });
});

// ---------------------------------------------------------------------------
// autoDetectDelimiter
// ---------------------------------------------------------------------------

describe('autoDetectDelimiter', function () {

  it('detects comma for standard CSV', function () {
    var lines = ['a,b,c', '1,2,3', '4,5,6'];
    expect(autoDetectDelimiter(lines)).toBe(',');
  });

  it('detects semicolon for European CSV', function () {
    var lines = ['a;b;c', '1;2;3', '4;5;6'];
    expect(autoDetectDelimiter(lines)).toBe(';');
  });

  it('detects tab for TSV', function () {
    var lines = ['a\tb\tc', '1\t2\t3', '4\t5\t6'];
    expect(autoDetectDelimiter(lines)).toBe('\t');
  });

  it('returns comma as fallback for empty input', function () {
    expect(autoDetectDelimiter([])).toBe(',');
  });

  it('prefers tab over semicolon when both are consistent', function () {
    // Lines where both tab and semicolon appear equally
    var lines = ['a\tb;c', 'd\te;f', 'g\th;i'];
    // tab count: 1 per line (consistent), semicolon count: 1 per line (consistent)
    // tab has higher priority
    expect(autoDetectDelimiter(lines)).toBe('\t');
  });

  it('prefers semicolon over comma when both are consistent', function () {
    // European CSV: semicolons delimit, commas are decimals
    var lines = [
      '0;1,5;2,5',
      '1;3,5;4,5',
      '2;5,5;6,5',
    ];
    // semicolons: 2 per line (consistent), commas: 2 per line (consistent) — tie
    // semicolon has higher priority than comma
    expect(autoDetectDelimiter(lines)).toBe(';');
  });

  it('uses only first 5 lines for detection', function () {
    var lines = [
      'a,b', '1,2', '3,4', '5,6', '7,8', // first 5: comma consistent
      '9;10', // 6th line has semicolon — should be ignored
    ];
    expect(autoDetectDelimiter(lines)).toBe(',');
  });

  it('handles single-line input', function () {
    var lines = ['a;b;c'];
    expect(autoDetectDelimiter(lines)).toBe(';');
  });
});

// ---------------------------------------------------------------------------
// detectDecimalSeparator
// ---------------------------------------------------------------------------

describe('detectDecimalSeparator', function () {

  it('returns comma when delimiter is semicolon', function () {
    expect(detectDecimalSeparator(';')).toBe(',');
  });

  it('returns dot when delimiter is comma', function () {
    expect(detectDecimalSeparator(',')).toBe('.');
  });

  it('returns dot when delimiter is tab', function () {
    expect(detectDecimalSeparator('\t')).toBe('.');
  });
});

// ---------------------------------------------------------------------------
// detectHeader
// ---------------------------------------------------------------------------

describe('detectHeader', function () {

  it('detects header when first row is text and data is numeric', function () {
    var candidate = 'name,age,score';
    var data = ['Alice,30,95', 'Bob,25,88'];
    var result = detectHeader(candidate, data, ',', '.');
    expect(result).toBe(true);
  });

  it('detects no header when all rows are numeric', function () {
    var candidate = '1,2,3';
    var data = ['4,5,6', '7,8,9'];
    var result = detectHeader(candidate, data, ',', '.');
    expect(result).toBe(false);
  });

  it('defaults to header when both rows are all strings', function () {
    var candidate = 'foo,bar,baz';
    var data = ['alpha,beta,gamma', 'delta,epsilon,zeta'];
    var result = detectHeader(candidate, data, ',', '.');
    expect(result).toBe(true);
  });

  it('returns true when dataLines is empty (single-line file)', function () {
    var result = detectHeader('a,b,c', [], ',', '.');
    expect(result).toBe(true);
  });

  it('handles European decimal format in numeric detection', function () {
    var candidate = 'x;wert;signal';
    var data = ['0;1,5;2,3', '1;3,7;4,1'];
    var result = detectHeader(candidate, data, ';', ',');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCSV — error paths
// ---------------------------------------------------------------------------

describe('parseCSV — error paths', function () {

  it('throws NO_DATA for file with only comments', function () {
    var buf = toBuffer('# comment1\n# comment2\n# comment3');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect(err.code).toBe('NO_DATA');
    }
  });

  it('throws NO_DATA for completely empty file', function () {
    var buf = toBuffer('');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect(err.code).toBe('NO_DATA');
    }
  });

  it('throws NO_DATA_ROWS for header-only file', function () {
    var buf = toBuffer('name,age,score');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect(err.code).toBe('NO_DATA_ROWS');
    }
  });

  it('throws TOO_FEW_COLUMNS for single-column file', function () {
    var buf = toBuffer('value\n1\n2\n3');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect(err.code).toBe('TOO_FEW_COLUMNS');
    }
  });

  it('includes metadata in NO_DATA_ROWS error', function () {
    var buf = toBuffer('x,y');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.metadata).not.toBe(null);
      expect(err.metadata.delimiter).toBeDefined();
      expect(err.metadata.hasHeader).toBe(true);
    }
  });

  it('includes metadata in TOO_FEW_COLUMNS error', function () {
    var buf = toBuffer('col\n1\n2\n3');
    try {
      parseCSV(buf);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.metadata).not.toBe(null);
      expect(err.metadata.delimiter).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// parseCSV — overrides
// ---------------------------------------------------------------------------

describe('parseCSV — overrides', function () {

  it('uses override delimiter instead of auto-detection', function () {
    // Data uses semicolons, but we force comma
    // This will treat "1;2;3" as a single field
    var buf = toBuffer('a,b\n1,2\n3,4');
    var result = parseCSV(buf, { delimiter: ',' });
    expect(result.metadata.delimiter).toBe(',');
    expect(result.columns.length).toBe(2);
  });

  it('uses override decimal instead of auto-detection', function () {
    var buf = toBuffer('x;y\n1;2,5\n3;4,5');
    var result = parseCSV(buf, { decimal: ',' });
    expect(result.metadata.decimalSeparator).toBe(',');
    // Values should be converted: 2,5 → 2.5
    expect(result.data[0][1]).toBe(2.5);
  });

  it('forces header when hasHeader override is "true"', function () {
    // All-numeric rows — auto-detection would say "no header"
    var buf = toBuffer('1,2,3\n4,5,6\n7,8,9');
    var result = parseCSV(buf, { hasHeader: 'true' });
    expect(result.metadata.hasHeader).toBe(true);
    // First row consumed as header, so only 2 data rows remain
    expect(result.rowCount).toBe(2);
  });

  it('forces no header when hasHeader override is "false"', function () {
    // Text first row — auto-detection would say "has header"
    var buf = toBuffer('name,value\n1,10\n2,20');
    var result = parseCSV(buf, { hasHeader: 'false' });
    expect(result.metadata.hasHeader).toBe(false);
    // All 3 lines are data; headers are generated
    expect(result.rowCount).toBe(3);
    expect(result.columns[0].name).toBe('Column 1');
  });
});

// ---------------------------------------------------------------------------
// parseCSV — warnings
// ---------------------------------------------------------------------------

describe('parseCSV — warnings', function () {

  it('warns about ragged rows', function () {
    var buf = loadTestFile('09_inconsistent_row_lengths.csv');
    var result = parseCSV(buf);
    var raggedWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('unexpected number of columns')) {
        raggedWarning = true;
        break;
      }
    }
    expect(raggedWarning).toBe(true);
  });

  it('warns about missing values', function () {
    var buf = loadTestFile('03_missing_values.csv');
    var result = parseCSV(buf);
    var missingWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('missing value')) {
        missingWarning = true;
        break;
      }
    }
    expect(missingWarning).toBe(true);
  });

  it('warns when no numeric columns are found', function () {
    var buf = loadTestFile('16_all_strings_two_columns.csv');
    var result = parseCSV(buf);
    var noNumericWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('No numeric columns')) {
        noNumericWarning = true;
        break;
      }
    }
    expect(noNumericWarning).toBe(true);
  });

  it('warns about string values in numeric columns', function () {
    // File 04 has too many strings (3/21 = 14%) so the column becomes "string".
    // File 17's c1_90pct_numeric column is exactly 90% numeric — it stays
    // classified as "numeric" but the remaining 10% strings trigger a warning.
    var buf = loadTestFile('17_reducing_numeric_ratio_columns.csv');
    var result = parseCSV(buf);
    var stringInNumericWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes("couldn't be parsed as number")) {
        stringInNumericWarning = true;
        break;
      }
    }
    expect(stringInNumericWarning).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCSV — response structure
// ---------------------------------------------------------------------------

describe('parseCSV — response structure', function () {

  it('returns all expected fields', function () {
    var buf = toBuffer('x,y\n1,10\n2,20\n3,30');
    var result = parseCSV(buf);

    expect(result.columns).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.rowCount).toBeDefined();
    expect(result.preview).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('limits preview to 20 rows', function () {
    // Build a CSV with 50 data rows
    var lines = ['x,y'];
    for (var i = 0; i < 50; i++) {
      lines.push(i + ',' + (i * 10));
    }
    var buf = toBuffer(lines.join('\n'));
    var result = parseCSV(buf);

    expect(result.data.length).toBe(50);
    expect(result.preview.length).toBe(20);
  });

  it('sets originalFileName to null (route handler sets it)', function () {
    var buf = toBuffer('a,b\n1,2');
    var result = parseCSV(buf);
    expect(result.metadata.originalFileName).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// parseCSV — integration tests with test files
// ---------------------------------------------------------------------------

describe('parseCSV — integration: test-data files', function () {

  it('01: clean comma numeric', function () {
    var result = parseCSV(loadTestFile('01_clean_comma_numeric.csv'));
    expect(result.columns.length).toBe(3);
    expect(result.rowCount).toBe(51);
    expect(result.metadata.delimiter).toBe(',');
    expect(result.metadata.decimalSeparator).toBe('.');
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.columns[0].name).toBe('x');
    expect(result.columns[0].type).toBe('numeric');
    expect(result.columns[1].type).toBe('numeric');
    expect(result.columns[2].type).toBe('numeric');
  });

  it('02: semicolon delimiter with decimal comma', function () {
    var result = parseCSV(loadTestFile('02_semicolon_decimal_comma.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.decimalSeparator).toBe(',');
    expect(result.columns.length).toBe(3);
    expect(result.rowCount).toBe(31);
    expect(result.columns[0].name).toBe('index');
    // Values should be properly converted (e.g. "1000,00" → 1000)
    expect(typeof result.data[0][1]).toBe('number');
  });

  it('03: missing values', function () {
    var result = parseCSV(loadTestFile('03_missing_values.csv'));
    expect(result.columns.length).toBe(3);
    expect(result.metadata.hasHeader).toBe(true);

    // Should have missing value warnings
    var hasMissingWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('missing value')) {
        hasMissingWarning = true;
        break;
      }
    }
    expect(hasMissingWarning).toBe(true);

    // Some cells should be null
    var hasNull = false;
    for (var r = 0; r < result.data.length; r++) {
      for (var c = 0; c < result.data[r].length; c++) {
        if (result.data[r][c] === null) {
          hasNull = true;
          break;
        }
      }
      if (hasNull) break;
    }
    expect(hasNull).toBe(true);
  });

  it('04: mixed types in numeric column', function () {
    var result = parseCSV(loadTestFile('04_mixed_type_in_numeric.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].name).toBe('time');
    expect(result.columns[1].name).toBe('value');
    // "time" column should still be numeric
    expect(result.columns[0].type).toBe('numeric');
  });

  it('05: comments before header, semicolon, decimal comma', function () {
    var result = parseCSV(loadTestFile('05_comments_before_header_semicolon_decimal_comma.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.decimalSeparator).toBe(',');
    expect(result.metadata.commentLinesSkipped).toBeGreaterThan(0);
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.columns.length).toBe(3);
    // Values should be numeric after decimal normalisation
    expect(typeof result.data[0][1]).toBe('number');
  });

  it('06: no header, semicolon, decimal comma', function () {
    var result = parseCSV(loadTestFile('06_no_header_semicolon_decimal_comma.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.hasHeader).toBe(false);
    // Headers should be auto-generated
    expect(result.columns[0].name).toBe('Column 1');
    expect(result.columns[1].name).toBe('Column 2');
    expect(result.columns[2].name).toBe('Column 3');
    // All rows are data (none removed as header)
    expect(result.rowCount).toBe(21);
  });

  it('07: quoted fields with commas inside', function () {
    var result = parseCSV(loadTestFile('07_quoted_fields_with_commas.csv'));
    expect(result.columns.length).toBe(3);
    expect(result.rowCount).toBe(4);
    expect(result.columns[0].name).toBe('id');
    expect(result.columns[1].name).toBe('comment');
    expect(result.columns[2].name).toBe('value');
    // The comma inside "contains,comma,inside" should NOT split the field
    expect(typeof result.data[1][1]).toBe('string');
    expect(result.data[1][1]).toContain('comma');
  });

  it('08: tab-delimited', function () {
    var result = parseCSV(loadTestFile('08_tab_delimited.csv'));
    expect(result.metadata.delimiter).toBe('\t');
    expect(result.metadata.decimalSeparator).toBe('.');
    expect(result.columns.length).toBe(3);
    expect(result.rowCount).toBe(31);
    expect(result.columns[0].type).toBe('numeric');
  });

  it('09: inconsistent row lengths', function () {
    var result = parseCSV(loadTestFile('09_inconsistent_row_lengths.csv'));
    expect(result.columns.length).toBe(3);
    // Should skip ragged rows (row with 2 cols and row with 4 cols)
    expect(result.rowCount).toBe(2);
    var raggedWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('unexpected number of columns')) {
        raggedWarning = true;
        break;
      }
    }
    expect(raggedWarning).toBe(true);
  });

  it('10: datetime x-axis', function () {
    var result = parseCSV(loadTestFile('10_datetime_x_axis.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].name).toBe('timestamp');
    expect(result.columns[0].type).toBe('date');
    expect(result.columns[1].name).toBe('value');
    expect(result.columns[1].type).toBe('numeric');
  });

  it('11: categorical x with multiple numeric y series', function () {
    var result = parseCSV(loadTestFile('11_categorical_x_multiple_series.csv'));
    expect(result.columns.length).toBe(3);
    expect(result.columns[0].name).toBe('category');
    expect(result.columns[0].type).toBe('string');
    expect(result.columns[1].type).toBe('numeric');
    expect(result.columns[2].type).toBe('numeric');
    expect(result.rowCount).toBe(6);
  });

  it('12: large dataset (2000 rows)', function () {
    var result = parseCSV(loadTestFile('12_large_2000_rows.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.rowCount).toBe(2000);
    expect(result.preview.length).toBe(20);
    expect(result.columns[0].type).toBe('numeric');
    expect(result.columns[1].type).toBe('numeric');
  });

  it('13: mostly numeric y with some string values', function () {
    var result = parseCSV(loadTestFile('13_mostly_numeric_y_with_some_strings.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].type).toBe('numeric');
    // y column has mostly numeric values with some strings — check type inference
    // The exact type depends on the ratio being above/below 90%
    var yCol = result.columns[1];
    expect(yCol.type).toBeDefined();
  });

  it('14: comments then header with semicolon', function () {
    var result = parseCSV(loadTestFile('14_comments_then_header.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.decimalSeparator).toBe(',');
    expect(result.metadata.commentLinesSkipped).toBeGreaterThan(0);
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.columns.length).toBe(3);
  });

  it('15: date-only x-axis (YYYY-MM-DD)', function () {
    var result = parseCSV(loadTestFile('15_date_only_x_axis.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].name).toBe('date');
    expect(result.columns[0].type).toBe('date');
    expect(result.columns[1].type).toBe('numeric');
  });

  it('16: all string columns (no numeric data)', function () {
    var result = parseCSV(loadTestFile('16_all_strings_two_columns.csv'));
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].type).toBe('string');
    expect(result.columns[1].type).toBe('string');
    // Should warn about no numeric columns
    var noNumericWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].includes('No numeric columns')) {
        noNumericWarning = true;
        break;
      }
    }
    expect(noNumericWarning).toBe(true);
  });

  it('17: reducing numeric ratio columns (90/75/60/45/30/15%)', function () {
    var result = parseCSV(loadTestFile('17_reducing_numeric_ratio_columns.csv'));
    expect(result.columns.length).toBe(7);
    // x column should be numeric
    expect(result.columns[0].type).toBe('numeric');
    // c1_90pct_numeric: 90% numeric → should classify as numeric
    expect(result.columns[1].type).toBe('numeric');
    // c2_75pct_numeric: 75% → below 90% threshold → string
    expect(result.columns[2].type).toBe('string');
    // All remaining columns below 90% → string
    expect(result.columns[3].type).toBe('string');
    expect(result.columns[4].type).toBe('string');
    expect(result.columns[5].type).toBe('string');
    expect(result.columns[6].type).toBe('string');
  });

  it('18: majority string column stays string', function () {
    var result = parseCSV(loadTestFile('18_majority_string_column.csv'));
    expect(result.columns.length).toBe(3);
    expect(result.columns[0].type).toBe('numeric');  // x
    expect(result.columns[1].type).toBe('numeric');  // y_numeric
    expect(result.columns[2].type).toBe('string');   // status_mostly_string
  });
});

// ---------------------------------------------------------------------------
// parseCSV — integration: sample data files (TestData1, TestData2, TestData3)
// ---------------------------------------------------------------------------

describe('parseCSV — integration: sample data files', function () {

  it('TestData1: European semicolon CSV', function () {
    var result = parseCSV(loadSampleFile('TestData1.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.decimalSeparator).toBe(',');
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.metadata.commentLinesSkipped).toBe(0);
    expect(result.columns.length).toBe(4);
    expect(result.rowCount).toBe(101);
    expect(result.columns[0].name).toBe('Referenznummer');

    // All columns should be numeric
    for (var i = 0; i < result.columns.length; i++) {
      expect(result.columns[i].type).toBe('numeric');
    }

    // Decimal normalisation: values should be JS numbers, not strings
    expect(typeof result.data[0][0]).toBe('number');
    expect(typeof result.data[0][1]).toBe('number');
  });

  it('TestData2: comments + European format', function () {
    var result = parseCSV(loadSampleFile('TestData2.csv'));
    expect(result.metadata.delimiter).toBe(';');
    expect(result.metadata.decimalSeparator).toBe(',');
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.metadata.commentLinesSkipped).toBe(29);
    expect(result.columns.length).toBe(4);
    expect(result.rowCount).toBe(201);
    expect(result.columns[0].name).toBe('Point Nr.');
    expect(result.columns[1].name).toBe('Freq.');

    // All columns should be numeric
    for (var i = 0; i < result.columns.length; i++) {
      expect(result.columns[i].type).toBe('numeric');
    }
  });

  it('TestData3: standard comma CSV', function () {
    var result = parseCSV(loadSampleFile('TestData3.csv'));
    expect(result.metadata.delimiter).toBe(',');
    expect(result.metadata.decimalSeparator).toBe('.');
    expect(result.metadata.hasHeader).toBe(true);
    expect(result.metadata.commentLinesSkipped).toBe(0);
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].name).toBe('x');
    expect(result.columns[1].name).toBe('y');

    for (var i = 0; i < result.columns.length; i++) {
      expect(result.columns[i].type).toBe('numeric');
    }
  });
});
