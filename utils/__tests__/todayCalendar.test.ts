import { describe, expect, it } from '@jest/globals';
import {
  getTodayCalendarDays,
  getTodayCalendarMonthTitle,
  getTodayCalendarWeekdayLabels,
} from '../todayCalendar';

describe('todayCalendar', () => {
  it('builds a six-week month grid with leading and trailing days', () => {
    const days = getTodayCalendarDays('2026-05-01', '2026-05-07', {
      currentDate: '2026-05-07',
    });

    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({
      date: '2026-04-26',
      dayNumber: 26,
      inCurrentMonth: false,
    });
    expect(days[5]).toMatchObject({
      date: '2026-05-01',
      dayNumber: 1,
      inCurrentMonth: true,
    });
    expect(days[41]).toMatchObject({
      date: '2026-06-06',
      dayNumber: 6,
      inCurrentMonth: false,
    });
  });

  it('marks selected date and today independently', () => {
    const days = getTodayCalendarDays('2026-05-01', '2026-05-08', {
      currentDate: '2026-05-07',
    });

    expect(days.find((day) => day.isSelected)).toMatchObject({
      date: '2026-05-08',
      isToday: false,
    });
    expect(days.find((day) => day.isToday)).toMatchObject({
      date: '2026-05-07',
      isSelected: false,
    });
  });

  it('rotates weekday labels and grid start by configured week start day', () => {
    const labels = getTodayCalendarWeekdayLabels(1);
    const days = getTodayCalendarDays('2026-05-01', '2026-05-07', {
      currentDate: '2026-05-07',
      weekStartDay: 1,
    });

    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days[0].date).toBe('2026-04-27');
  });

  it('formats the month title', () => {
    expect(getTodayCalendarMonthTitle('2026-05-07')).toBe('May 2026');
  });
});
