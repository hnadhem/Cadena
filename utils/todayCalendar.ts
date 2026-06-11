import dayjs from 'dayjs';

export interface TodayCalendarDay {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAYS_IN_CALENDAR_GRID = 42;

export function getTodayCalendarMonthTitle(monthDate: dayjs.ConfigType): string {
  return dayjs(monthDate).format('MMMM YYYY');
}

export function getTodayCalendarWeekdayLabels(weekStartDay = 0): string[] {
  const startDay = normalizeWeekStartDay(weekStartDay);

  return [
    ...WEEKDAY_LABELS.slice(startDay),
    ...WEEKDAY_LABELS.slice(0, startDay),
  ];
}

export function getTodayCalendarDays(
  monthDate: dayjs.ConfigType,
  selectedDate: dayjs.ConfigType,
  options: {
    currentDate?: dayjs.ConfigType;
    weekStartDay?: number;
  } = {}
): TodayCalendarDay[] {
  const monthStart = dayjs(monthDate).startOf('month');
  const selectedDay = dayjs(selectedDate).format('YYYY-MM-DD');
  const today = dayjs(options.currentDate ?? new Date()).format('YYYY-MM-DD');
  const weekStartDay = normalizeWeekStartDay(options.weekStartDay);
  const leadingDayCount = (monthStart.day() - weekStartDay + 7) % 7;
  const gridStart = monthStart.subtract(leadingDayCount, 'day');

  return Array.from({ length: DAYS_IN_CALENDAR_GRID }, (_, index) => {
    const day = gridStart.add(index, 'day');
    const date = day.format('YYYY-MM-DD');

    return {
      date,
      dayNumber: day.date(),
      inCurrentMonth: day.month() === monthStart.month(),
      isSelected: date === selectedDay,
      isToday: date === today,
    };
  });
}

function normalizeWeekStartDay(weekStartDay: number | undefined): number {
  if (weekStartDay === undefined || !Number.isFinite(weekStartDay)) return 0;

  return ((Math.trunc(weekStartDay) % 7) + 7) % 7;
}
