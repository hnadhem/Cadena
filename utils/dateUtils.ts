import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Returns the display date for a given timestamp, accounting for the day
 * boundary offset. Activity logged between midnight and dayEndTime counts
 * toward the previous calendar day.
 */
export function getEffectiveDate(date: dayjs.ConfigType, dayEndTime = '00:00'): dayjs.Dayjs {
  const d = dayjs(date);
  if (dayEndTime === '00:00') return d.startOf('day');

  const [endHour, endMin] = dayEndTime.split(':').map(Number);
  const boundary = d.startOf('day').add(endHour, 'hour').add(endMin ?? 0, 'minute');

  return d.isBefore(boundary) ? d.subtract(1, 'day').startOf('day') : d.startOf('day');
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
  const target = getEffectiveDate(date, dayEndTime);
  const today = getEffectiveDate(currentDate, dayEndTime);
  const diff = today.diff(target, 'day');
  return diff >= 0 && diff <= 3;
}
