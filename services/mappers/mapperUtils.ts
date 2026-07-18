type RowObject = Record<string, unknown>;

export function readRowObject(row: unknown, table: string): RowObject {
  if (!isRowObject(row)) {
    throw new Error(`Invalid ${table} row: expected object, received ${formatValue(row)}.`);
  }

  return row;
}

export function readString(row: RowObject, table: string, column: string): string {
  const value = row[column];

  if (typeof value !== 'string') {
    throwInvalidColumn(table, column, 'string', value);
  }

  return value;
}

export function readNullableString(
  row: RowObject,
  table: string,
  column: string
): string | undefined {
  const value = row[column];

  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwInvalidColumn(table, column, 'string or null', value);
  }

  return value;
}

export function readNumber(row: RowObject, table: string, column: string): number {
  const value = row[column];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwInvalidColumn(table, column, 'number', value);
  }

  return value;
}

export function readNullableNumber(
  row: RowObject,
  table: string,
  column: string
): number | undefined {
  const value = row[column];

  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwInvalidColumn(table, column, 'number or null', value);
  }

  return value;
}

export function readBooleanInt(row: RowObject, table: string, column: string): boolean {
  const value = row[column];

  if (value === 0) return false;
  if (value === 1) return true;

  throwInvalidColumn(table, column, '0 or 1', value);
}

export function booleanToInt(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function readStringEnum<T extends string>(
  row: RowObject,
  table: string,
  column: string,
  allowedValues: readonly T[]
): T {
  const value = readString(row, table, column);
  return parseEnumValue(table, column, value, allowedValues);
}

export function readNullableStringEnum<T extends string>(
  row: RowObject,
  table: string,
  column: string,
  allowedValues: readonly T[]
): T | undefined {
  const value = readNullableString(row, table, column);

  if (value === undefined) {
    return undefined;
  }

  return parseEnumValue(table, column, value, allowedValues);
}

export function readNumberArrayJson(
  row: RowObject,
  table: string,
  column: string
): number[] | undefined {
  const value = row[column];

  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwInvalidColumn(table, column, 'JSON array string or null', value);
  }

  const parsed = parseJsonColumn(value, table, column);

  if (!Array.isArray(parsed)) {
    throwInvalidColumn(table, column, 'JSON array of numbers', value);
  }

  const numbers: number[] = [];

  for (const item of parsed) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throwInvalidColumn(table, column, 'JSON array of numbers', value);
    }

    numbers.push(item);
  }

  return numbers;
}

export function readStringArrayJson(
  row: RowObject,
  table: string,
  column: string
): string[] | undefined {
  const value = row[column];

  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwInvalidColumn(table, column, 'JSON array string or null', value);
  }

  const parsed = parseJsonColumn(value, table, column);

  if (!Array.isArray(parsed)) {
    throwInvalidColumn(table, column, 'JSON array of strings', value);
  }

  const strings: string[] = [];

  for (const item of parsed) {
    if (typeof item !== 'string') {
      throwInvalidColumn(table, column, 'JSON array of strings', value);
    }

    strings.push(item);
  }

  return strings;
}

export function jsonArrayOrNull(values: readonly number[] | readonly string[] | undefined): string | null {
  return values === undefined ? null : JSON.stringify(values);
}

function isRowObject(value: unknown): value is RowObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEnumValue<T extends string>(
  table: string,
  column: string,
  value: string,
  allowedValues: readonly T[]
): T {
  for (const allowedValue of allowedValues) {
    if (value === allowedValue) {
      return allowedValue;
    }
  }

  throwInvalidColumn(table, column, `one of ${allowedValues.join(', ')}`, value);
}

function parseJsonColumn(value: string, table: string, column: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    throwInvalidColumn(table, column, 'valid JSON array string', value);
  }
}

function throwInvalidColumn(
  table: string,
  column: string,
  expected: string,
  value: unknown
): never {
  throw new Error(
    `Invalid ${table}.${column}: expected ${expected}, received ${formatValue(value)}.`
  );
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);

  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}
