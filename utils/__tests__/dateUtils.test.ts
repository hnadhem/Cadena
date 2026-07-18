import { describe, expect, it } from '@jest/globals';
import {
  addDaysToIsoDate,
  formatDateLabelInTimezone,
  resolveLogicalDate,
} from '../dateUtils';

describe('dateUtils', () => {
  it('formats the date label in the requested timezone', () => {
    const instant = new Date('2026-06-06T03:30:00.000Z');

    expect(formatDateLabelInTimezone(instant, 'America/New_York')).toBe('June 5');
    expect(formatDateLabelInTimezone(instant, 'Asia/Tokyo')).toBe('June 6');
  });

  it('does not shift dates when dayEndTime is midnight', () => {
    expect(resolveLogicalDate('2026-05-07T23:59:00.000Z', 'UTC', '00:00')).toBe(
      '2026-05-07'
    );
    expect(resolveLogicalDate('2026-05-08T00:01:00.000Z', 'UTC', '00:00')).toBe(
      '2026-05-08'
    );
  });

  it('shifts strictly before dayEndTime and not at the boundary', () => {
    expect(resolveLogicalDate('2026-05-08T02:59:59.000Z', 'UTC', '03:00')).toBe(
      '2026-05-07'
    );
    expect(resolveLogicalDate('2026-05-08T03:00:00.000Z', 'UTC', '03:00')).toBe(
      '2026-05-08'
    );
    expect(resolveLogicalDate('2026-05-08T03:00:01.000Z', 'UTC', '03:00')).toBe(
      '2026-05-08'
    );
  });

  it('resolves the same instant differently across timezones', () => {
    const instant = '2026-05-07T02:30:00.000Z';

    expect(resolveLogicalDate(instant, 'America/New_York', '00:00')).toBe('2026-05-06');
    expect(resolveLogicalDate(instant, 'Europe/Istanbul', '00:00')).toBe('2026-05-07');
  });

  it('handles a spring-forward boundary that does not exist in local wall time', () => {
    expect(() =>
      resolveLogicalDate('2026-03-08T06:59:59.000Z', 'America/New_York', '02:30')
    ).not.toThrow();
    expect(resolveLogicalDate('2026-03-08T06:59:59.000Z', 'America/New_York', '02:30')).toBe(
      '2026-03-07'
    );
    expect(resolveLogicalDate('2026-03-08T07:00:00.000Z', 'America/New_York', '02:30')).toBe(
      '2026-03-08'
    );
  });

  it('resolves repeated fall-back wall times deterministically', () => {
    expect(resolveLogicalDate('2026-11-01T05:30:00.000Z', 'America/New_York', '02:00')).toBe(
      '2026-10-31'
    );
    expect(resolveLogicalDate('2026-11-01T06:30:00.000Z', 'America/New_York', '02:00')).toBe(
      '2026-10-31'
    );
  });

  it('adds days using calendar dates across DST and month/year boundaries', () => {
    expect(addDaysToIsoDate('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysToIsoDate('2026-03-08', -1)).toBe('2026-03-07');
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToIsoDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('shifts to the prior year across the logical date boundary', () => {
    expect(resolveLogicalDate('2026-01-01T00:30:00.000Z', 'UTC', '02:00')).toBe(
      '2025-12-31'
    );
  });
});
