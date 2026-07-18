import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

interface WallClockParts extends IsoDateParts {
  hour: number;
  minute: number;
  second: number;
}

const WALL_CLOCK_FORMATTER_OPTIONS: Intl.DateTimeFormatOptions = {
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

/**
 * Resolves an instant to the app's logical date in the requested timezone.
 */
export function resolveLogicalDate(
  instant: Date | string,
  timezoneName: string,
  dayEndTime: string
): string {
  const boundaryMinutes = parseDayEndTime(dayEndTime);
  const wallClock = getWallClockParts(instant, timezoneName);
  const wallDate = formatIsoDate(wallClock.year, wallClock.month, wallClock.day);

  if (boundaryMinutes === 0) return wallDate;

  const wallClockSeconds = wallClock.hour * 60 * 60 + wallClock.minute * 60 + wallClock.second;
  const boundarySeconds = boundaryMinutes * 60;

  return wallClockSeconds < boundarySeconds ? addDaysToIsoDate(wallDate, -1) : wallDate;
}

export function currentLogicalDate(timezoneName: string, dayEndTime: string): string {
  return resolveLogicalDate(new Date(), timezoneName, dayEndTime);
}

export function addDaysToIsoDate(date: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error('days must be an integer.');
  }

  const parts = parseIsoDate(date);

  if (days === 0) {
    return formatIsoDate(parts.year, parts.month, parts.day);
  }

  let year = parts.year;
  let month = parts.month;
  let day = parts.day;
  let remainingDays = days;

  while (remainingDays > 0) {
    const daysLeftInMonth = getDaysInMonth(year, month) - day;

    if (remainingDays <= daysLeftInMonth) {
      day += remainingDays;
      remainingDays = 0;
    } else {
      remainingDays -= daysLeftInMonth + 1;
      day = 1;
      month += 1;

      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  while (remainingDays < 0) {
    if (day + remainingDays > 0) {
      day += remainingDays;
      remainingDays = 0;
    } else {
      remainingDays += day;
      month -= 1;

      if (month < 1) {
        month = 12;
        year -= 1;
      }

      day = getDaysInMonth(year, month);
    }
  }

  return formatIsoDate(year, month, day);
}

/**
 * Returns the display date for a given timestamp, accounting for the day
 * boundary offset. Activity logged between midnight and dayEndTime counts
 * toward the previous calendar day.
 */
export function getEffectiveDate(date: dayjs.ConfigType, dayEndTime = '00:00'): dayjs.Dayjs {
  const d = dayjs(date);
  if (dayEndTime === '00:00') return d.startOf('day');

  const boundaryMinutes = parseDayEndTime(dayEndTime);
  const wallDate = d.format('YYYY-MM-DD');
  const wallClockSeconds = d.hour() * 60 * 60 + d.minute() * 60 + d.second();
  const boundarySeconds = boundaryMinutes * 60;
  const logicalDate =
    wallClockSeconds < boundarySeconds ? addDaysToIsoDate(wallDate, -1) : wallDate;

  return dayjs(logicalDate).startOf('day');
}

export function getDeviceTimezone(): string {
  return dayjs.tz.guess();
}

export function formatDateLabelInTimezone(
  date: dayjs.ConfigType,
  timezoneName = getDeviceTimezone()
): string {
  try {
    return dayjs.tz(date, timezoneName).format('MMMM D');
  } catch {
    return dayjs.tz(date, getDeviceTimezone()).format('MMMM D');
  }
}

/**
 * Returns "Today", "Yesterday", "Tomorrow", or a formatted date string.
 */
export function formatRelativeDay(date: dayjs.ConfigType): string {
  const d = dayjs(date).startOf('day');
  const today = dayjs().startOf('day');
  const diff = d.diff(today, 'day');

  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.format('MMM D, YYYY');
}

/**
 * Returns true if the given date falls within the 3-calendar-day retroactive
 * window from the end of the current day (per dayEndTime).
 */
export function isWithinRetroactiveWindow(
  date: dayjs.ConfigType,
  currentDate: dayjs.ConfigType,
  dayEndTime = '00:00'
): boolean {
  const target = getEffectiveDate(date, dayEndTime).format('YYYY-MM-DD');
  const today = getEffectiveDate(currentDate, dayEndTime).format('YYYY-MM-DD');
  const windowStart = addDaysToIsoDate(today, -3);

  return target >= windowStart && target <= today;
}

function getWallClockParts(instant: Date | string, timezoneName: string): WallClockParts {
  const date = toDateInstant(instant);
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat('en-US', {
      ...WALL_CLOCK_FORMATTER_OPTIONS,
      timeZone: timezoneName,
    }).formatToParts(date);
  } catch {
    throw new Error(`Unable to resolve date in timezone "${timezoneName}".`);
  }

  const values: Partial<Record<string, string>> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const hour = readNumericPart(values, 'hour');

  return {
    year: readNumericPart(values, 'year'),
    month: readNumericPart(values, 'month'),
    day: readNumericPart(values, 'day'),
    hour: hour === 24 ? 0 : hour,
    minute: readNumericPart(values, 'minute'),
    second: readNumericPart(values, 'second'),
  };
}

function toDateInstant(instant: Date | string): Date {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error('instant must be a valid Date or ISO string.');
  }

  return date;
}

function readNumericPart(parts: Partial<Record<string, string>>, key: string): number {
  const value = parts[key];

  if (value === undefined) {
    throw new Error(`Intl.DateTimeFormat did not provide a ${key} part.`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Intl.DateTimeFormat provided an invalid ${key} part.`);
  }

  return parsed;
}

function parseDayEndTime(dayEndTime: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(dayEndTime);

  if (!match) {
    throw new Error('dayEndTime must use HH:mm format.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const totalMinutes = hour * 60 + minute;

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    totalMinutes < 0 ||
    totalMinutes > 4 * 60
  ) {
    throw new Error('dayEndTime must be between 00:00 and 04:00.');
  }

  return totalMinutes;
}

function parseIsoDate(date: string): IsoDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error('date must use YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month)) {
    throw new Error('date must be a valid calendar date.');
  }

  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
