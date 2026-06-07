import { describe, expect, it } from '@jest/globals';
import { formatDateLabelInTimezone } from '../dateUtils';

describe('dateUtils', () => {
  it('formats the date label in the requested timezone', () => {
    const instant = new Date('2026-06-06T03:30:00.000Z');

    expect(formatDateLabelInTimezone(instant, 'America/New_York')).toBe('June 5');
    expect(formatDateLabelInTimezone(instant, 'Asia/Tokyo')).toBe('June 6');
  });
});
