import { describe, expect, it } from '@jest/globals';
import { EnabledModule } from '../../constants/enums';
import type { TodayHabitItem } from '../../types/today';
import {
  formatTodayDateLabels,
  getTodayHabitCompletionSummary,
  getVisibleTodayQuickActions,
  sortTodayHabitItems,
} from '../todaySelectors';

function habit(overrides: Partial<TodayHabitItem>): TodayHabitItem {
  return {
    id: overrides.id ?? 'item-id',
    habitId: overrides.habitId ?? overrides.id ?? 'habit-id',
    title: overrides.title ?? 'Habit',
    status: overrides.status ?? 'pending',
    habitType: overrides.habitType ?? 'binary',
    displayOrder: overrides.displayOrder ?? 0,
    scheduledTime: overrides.scheduledTime,
    completedAt: overrides.completedAt,
    subtitle: overrides.subtitle,
    value: overrides.value,
    targetValue: overrides.targetValue,
    targetUnit: overrides.targetUnit,
    streakCount: overrides.streakCount,
  };
}

describe('todaySelectors', () => {
  it('computes habit completion summary from habit items', () => {
    const summary = getTodayHabitCompletionSummary([
      habit({ id: 'one', status: 'completed' }),
      habit({ id: 'two', status: 'pending' }),
      habit({ id: 'three', status: 'missed' }),
    ]);

    expect(summary).toEqual({
      completedHabitCount: 1,
      totalVisibleHabitCount: 3,
    });
  });

  it('sorts completed untimed habits to the bottom', () => {
    const sorted = sortTodayHabitItems([
      habit({ id: 'completed-first-order', status: 'completed', displayOrder: 1 }),
      habit({ id: 'pending-second-order', status: 'pending', displayOrder: 2 }),
      habit({ id: 'pending-first-order', status: 'pending', displayOrder: 1 }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      'pending-first-order',
      'pending-second-order',
      'completed-first-order',
    ]);
  });

  it('keeps completed timed habits in scheduled chronological order', () => {
    const sorted = sortTodayHabitItems([
      habit({ id: 'late-completed', status: 'completed', scheduledTime: '09:00' }),
      habit({ id: 'middle-pending', status: 'pending', scheduledTime: '08:00' }),
      habit({ id: 'early-completed', status: 'completed', scheduledTime: '07:00' }),
      habit({ id: 'untimed-pending', status: 'pending', displayOrder: 0 }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      'early-completed',
      'middle-pending',
      'late-completed',
      'untimed-pending',
    ]);
  });

  it('hides Medication quick action by default', () => {
    const actionKinds = getVisibleTodayQuickActions().map((action) => action.kind);

    expect(actionKinds).toEqual(['checkIn', 'nutrition', 'tally']);
  });

  it('shows Medication quick action when medication module is enabled', () => {
    const actionKinds = getVisibleTodayQuickActions([EnabledModule.MEDICATIONS]).map(
      (action) => action.kind
    );

    expect(actionKinds).toEqual(['checkIn', 'nutrition', 'medication', 'tally']);
  });

  it('formats Today, Tomorrow, and Yesterday titles against the current logical date', () => {
    const options = { currentDate: '2026-05-07T12:00:00' };

    expect(formatTodayDateLabels('2026-05-07', options)).toEqual({
      title: 'Today',
      subtitle: 'May 7',
    });
    expect(formatTodayDateLabels('2026-05-08', options)).toEqual({
      title: 'Tomorrow',
      subtitle: 'May 8',
    });
    expect(formatTodayDateLabels('2026-05-06', options)).toEqual({
      title: 'Yesterday',
      subtitle: 'May 6',
    });
  });

  it('uses weekday title for dates outside the relative window', () => {
    const labels = formatTodayDateLabels('2026-05-09', {
      currentDate: '2026-05-07T12:00:00',
    });

    expect(labels).toEqual({
      title: 'Saturday',
      subtitle: 'May 9',
    });
  });
});
