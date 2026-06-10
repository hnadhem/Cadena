import { describe, expect, it } from '@jest/globals';
import {
  decrementTodayTallyCount,
  getTodayTallyProgressPercent,
  getTodayTallyRowsForDate,
  incrementTodayTallyCount,
  type TodayTallyItem,
  type TodayTallyUpdateResult,
} from '../todayTally';

function expectUpdated(result: TodayTallyUpdateResult) {
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result;
}

describe('todayTally', () => {
  it('increments one tally item by date', () => {
    const result = expectUpdated(
      incrementTodayTallyCount({}, '2026-05-07', 'water')
    );

    expect(result.tallyLogsByDate['2026-05-07'].water).toMatchObject({
      tallyItemId: 'water',
      periodStartDate: '2026-05-07',
      periodEndDate: '2026-05-07',
      count: 33,
    });
  });

  it('keeps the same-date updated count in memory', () => {
    const firstUpdate = expectUpdated(
      incrementTodayTallyCount({}, '2026-05-07', 'pushUps')
    ).tallyLogsByDate;

    const secondUpdate = expectUpdated(
      incrementTodayTallyCount(firstUpdate, '2026-05-07', 'pushUps')
    ).tallyLogsByDate;

    const rows = getTodayTallyRowsForDate(secondUpdate, '2026-05-07');

    expect(rows.find((row) => row.item.id === 'pushUps')?.log.count).toBe(72);
  });

  it('keeps different dates isolated', () => {
    const firstDate = expectUpdated(
      incrementTodayTallyCount({}, '2026-05-07', 'steps')
    ).tallyLogsByDate;

    const secondDate = expectUpdated(
      incrementTodayTallyCount(firstDate, '2026-05-08', 'steps')
    ).tallyLogsByDate;

    expect(
      getTodayTallyRowsForDate(secondDate, '2026-05-07').find(
        (row) => row.item.id === 'steps'
      )?.log.count
    ).toBe(4201);
    expect(
      getTodayTallyRowsForDate(secondDate, '2026-05-08').find(
        (row) => row.item.id === 'steps'
      )?.log.count
    ).toBe(4201);
    expect(
      getTodayTallyRowsForDate(secondDate, '2026-05-09').find(
        (row) => row.item.id === 'steps'
      )?.log.count
    ).toBe(4200);
  });

  it('clamps progress at 100%', () => {
    expect(getTodayTallyProgressPercent(150, 100)).toBe(100);
    expect(getTodayTallyProgressPercent(-5, 100)).toBe(0);
    expect(getTodayTallyProgressPercent(5, 0)).toBe(0);
  });

  it('does not decrement below 0', () => {
    const items: TodayTallyItem[] = [
      {
        id: 'zero',
        name: 'Zero',
        resetFrequency: 'daily',
        displayOrder: 0,
        periodLabel: 'today',
        initialCount: 0,
      },
    ];

    const result = expectUpdated(
      decrementTodayTallyCount({}, '2026-05-07', 'zero', items)
    );

    expect(result.tallyLogsByDate['2026-05-07'].zero.count).toBe(0);
  });
});
