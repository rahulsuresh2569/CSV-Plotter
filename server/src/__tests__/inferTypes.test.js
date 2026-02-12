import { describe, it, expect } from 'vitest';
import { inferColumnTypes } from '../services/inferTypes.js';

// Helper: build rows for a single column from an array of values
function singleColumn(values) {
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    rows.push([values[i]]);
  }
  return rows;
}

// Helper: classify a single column and return its type
function classifySingle(values) {
  var result = inferColumnTypes(['col'], singleColumn(values));
  return result[0].type;
}

// -------------------------------------------------------------------------
// isDateValue is not exported, so we test date detection behavior
// indirectly through inferColumnTypes.
// -------------------------------------------------------------------------

describe('date detection via inferColumnTypes', function () {

  it('recognises ISO 8601 date (YYYY-MM-DD)', function () {
    var values = [
      '2026-01-01', '2026-02-15', '2026-03-20',
      '2026-04-10', '2026-05-05',
    ];
    expect(classifySingle(values)).toBe('date');
  });

  it('recognises ISO 8601 datetime (with T and time)', function () {
    var values = [
      '2026-02-01T08:00:00', '2026-02-01T09:15:00',
      '2026-02-01T10:30:00', '2026-02-01T11:45:00',
      '2026-02-01T12:00:00',
    ];
    expect(classifySingle(values)).toBe('date');
  });

  it('recognises ISO 8601 with timezone suffix', function () {
    var values = [
      '2026-02-01T08:00:00Z', '2026-02-01T09:00:00Z',
      '2026-02-01T10:00:00Z', '2026-02-01T11:00:00Z',
      '2026-02-01T12:00:00Z',
    ];
    expect(classifySingle(values)).toBe('date');
  });

  it('recognises slash-separated dates', function () {
    var values = [
      '02/01/2026', '03/15/2026', '04/20/2026',
      '05/10/2026', '06/01/2026',
    ];
    expect(classifySingle(values)).toBe('date');
  });

  it('does not classify dot-separated European dates (Date.parse rejects dd.MM.yyyy)', function () {
    // The regex matches but Date.parse cannot parse "01.02.2026" reliably,
    // so isDateValue returns false. This is intentional — the code requires
    // BOTH a pattern match AND a valid Date.parse result.
    var values = [
      '01.02.2026', '15.03.2026', '20.04.2026',
      '10.05.2026', '01.06.2026',
    ];
    expect(classifySingle(values)).toBe('string');
  });

  it('recognises space-separated datetime', function () {
    var values = [
      '2026-02-01 08:00:00', '2026-02-01 09:00:00',
      '2026-02-01 10:00:00', '2026-02-01 11:00:00',
      '2026-02-01 12:00:00',
    ];
    expect(classifySingle(values)).toBe('date');
  });

  it('does not classify plain numbers as dates', function () {
    var values = [1, 2, 3, 4, 5];
    expect(classifySingle(values)).toBe('numeric');
  });

  it('does not classify random strings as dates', function () {
    var values = ['hello', 'world', 'foo', 'bar', 'baz'];
    expect(classifySingle(values)).toBe('string');
  });

  it('does not classify partial date strings as dates', function () {
    var values = ['2026-02', '2026', '02-2026', 'Feb 2026', 'Q1 2026'];
    expect(classifySingle(values)).toBe('string');
  });
});

// -------------------------------------------------------------------------
// inferColumnTypes — numeric classification
// -------------------------------------------------------------------------

describe('inferColumnTypes — numeric classification', function () {

  it('classifies all-numeric column as numeric', function () {
    var values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(classifySingle(values)).toBe('numeric');
  });

  it('classifies column at exactly 90% numeric as numeric', function () {
    // 9 numbers + 1 string = 90%
    var values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'oops'];
    expect(classifySingle(values)).toBe('numeric');
  });

  it('classifies column at 89% numeric as string (below threshold)', function () {
    // 89 numbers + 11 strings = 89%
    var values = [];
    for (var i = 0; i < 89; i++) {
      values.push(i);
    }
    for (var j = 0; j < 11; j++) {
      values.push('bad');
    }
    expect(classifySingle(values)).toBe('string');
  });

  it('classifies all-string column as string', function () {
    var values = ['alpha', 'beta', 'gamma', 'delta'];
    expect(classifySingle(values)).toBe('string');
  });

  it('skips null values when calculating ratios', function () {
    // 5 numbers + 5 nulls = 100% of non-null are numeric
    var values = [1, null, 2, null, 3, null, 4, null, 5, null];
    expect(classifySingle(values)).toBe('numeric');
  });

  it('returns string when all values are null', function () {
    var values = [null, null, null, null, null];
    expect(classifySingle(values)).toBe('string');
  });

  it('excludes Infinity from numeric count', function () {
    var values = [Infinity, Infinity, Infinity, Infinity, Infinity];
    expect(classifySingle(values)).toBe('string');
  });

  it('excludes NaN from numeric count', function () {
    var values = [NaN, NaN, NaN, NaN, NaN];
    expect(classifySingle(values)).toBe('string');
  });

  it('numeric takes priority over date for year-like numbers', function () {
    // Values like 2026 are valid numbers — should be numeric, not date
    var values = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029];
    expect(classifySingle(values)).toBe('numeric');
  });
});

// -------------------------------------------------------------------------
// inferColumnTypes — multi-column
// -------------------------------------------------------------------------

describe('inferColumnTypes — multi-column', function () {

  it('classifies multiple columns independently', function () {
    var headers = ['id', 'timestamp', 'label'];
    var rows = [
      [1, '2026-01-01', 'alpha'],
      [2, '2026-01-02', 'beta'],
      [3, '2026-01-03', 'gamma'],
      [4, '2026-01-04', 'delta'],
      [5, '2026-01-05', 'epsilon'],
    ];
    var result = inferColumnTypes(headers, rows);

    expect(result[0].type).toBe('numeric');
    expect(result[0].name).toBe('id');
    expect(result[1].type).toBe('date');
    expect(result[1].name).toBe('timestamp');
    expect(result[2].type).toBe('string');
    expect(result[2].name).toBe('label');
  });

  it('returns correct index for each column', function () {
    var headers = ['a', 'b', 'c'];
    var rows = [[1, 2, 3]];
    var result = inferColumnTypes(headers, rows);

    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
    expect(result[2].index).toBe(2);
  });

  it('includes numericCount and nonNullCount in results', function () {
    var headers = ['col'];
    var rows = [[1], [2], [null], ['text'], [5]];
    var result = inferColumnTypes(headers, rows);

    expect(result[0].numericCount).toBe(3);
    expect(result[0].nonNullCount).toBe(4);
  });
});
