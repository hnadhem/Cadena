import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { AppMode, EnabledModule } from '../../constants/enums';
import { useHabitStore } from '../../store/habitStore';
import type { Habit, HabitLog, UserPreferences } from '../../types/schema';
import { getDb } from '../db';
import { getTodayViewModel } from '../todayService';

jest.mock('../db', () => ({
  getDb: jest.fn(),
}));

const mockGetDb = jest.mocked(getDb);

function preferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId: 'user-id',
    appMode: AppMode.COMBINED,
    weightUnit: 'lbs',
    distanceUnit: 'mi',
    weekStartDay: 0,
    theme: 'system',
    colorScheme: 'muted',
    requireBiometricForHiddenHabits: false,
    dayEndTime: '00:00',
    seenProgressionIntentTooltip: false,
    modulesEnabled: [],
    goals: [],
    ...overrides,
  };
}

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: overrides.id ?? 'habit-id',
    userId: 'user-id',
    name: overrides.name ?? 'Habit',
    isHidden: overrides.isHidden ?? false,
    trackEffort: false,
    startDate: '2026-05-01',
    allowMultiplePerDay: false,
    displayOrder: overrides.displayOrder ?? 0,
    isPinned: false,
    archivedAt: overrides.archivedAt,
    createdAt: '2026-05-01T12:00:00',
    description: overrides.description,
    parentHabitId: overrides.parentHabitId,
    category: overrides.category,
    color: overrides.color,
    icon: overrides.icon,
    linkedTallyItemId: overrides.linkedTallyItemId,
  };
}

function habitLog(overrides: Partial<HabitLog>): HabitLog {
  return {
    id: overrides.id ?? 'log-id',
    habitId: overrides.habitId ?? 'habit-id',
    userId: 'user-id',
    date: overrides.date ?? '2026-05-07',
    completed: overrides.completed ?? false,
    value: overrides.value,
    effortRating: overrides.effortRating,
    note: overrides.note,
    completedAt: overrides.completedAt,
  };
}

function mockPersistedFitnessRows(workoutRows: unknown[], cardioRows: unknown[]) {
  const getAllAsync = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
  getAllAsync.mockResolvedValueOnce(workoutRows);
  getAllAsync.mockResolvedValueOnce(cardioRows);
  mockGetDb.mockReturnValue({ getAllAsync } as unknown as ReturnType<typeof getDb>);
  return { getAllAsync };
}

describe('todayService', () => {
  beforeEach(() => {
    useHabitStore.setState({ habits: [], todayLogs: [] });
    mockGetDb.mockReset();
  });

  it('builds a basic Today view model without persisted fitness data when no user is loaded', async () => {
    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00',
      userId: null,
      preferences: preferences(),
    });

    expect(viewModel).toMatchObject({
      selectedDate: '2026-05-07',
      title: 'Today',
      subtitle: 'May 7',
      fitnessItems: [],
      completedHabitCount: 0,
      totalVisibleHabitCount: 0,
    });
    expect(viewModel.quickActions.map((action) => action.kind)).toEqual([
      'checkIn',
      'nutrition',
      'tally',
    ]);
  });

  it('composes visible habit items from the current habit store state', async () => {
    useHabitStore.getState().loadHabits(
      [
        habit({ id: 'pending', name: 'Pending', displayOrder: 2 }),
        habit({ id: 'completed', name: 'Completed', displayOrder: 1 }),
        habit({ id: 'hidden', name: 'Hidden', isHidden: true }),
        habit({ id: 'archived', name: 'Archived', archivedAt: '2026-05-06T12:00:00' }),
      ],
      [
        habitLog({
          id: 'completed-log',
          habitId: 'completed',
          completed: true,
          completedAt: '2026-05-07T08:00:00',
        }),
        habitLog({ id: 'hidden-log', habitId: 'hidden', completed: true }),
      ]
    );

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-08T12:00:00',
      userId: null,
      preferences: preferences(),
    });

    expect(viewModel.completedHabitCount).toBe(1);
    expect(viewModel.totalVisibleHabitCount).toBe(2);
    expect(viewModel.habitItems.map((item) => [item.habitId, item.status])).toEqual([
      ['pending', 'missed'],
      ['completed', 'completed'],
    ]);
  });

  it('uses module preferences when composing quick actions', async () => {
    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00',
      userId: null,
      preferences: preferences({ modulesEnabled: [EnabledModule.MEDICATIONS] }),
    });

    expect(viewModel.quickActions.map((action) => action.kind)).toEqual([
      'checkIn',
      'nutrition',
      'medication',
      'tally',
    ]);
  });

  it('loads cardio items by cardioDate while preserving timestamp date checks', async () => {
    const { getAllAsync } = mockPersistedFitnessRows([], [
      {
        id: 'retro-cardio',
        templateId: null,
        scheduleId: null,
        templateNameSnapshot: null,
        type: 'running',
        subtype: null,
        sportName: null,
        status: 'completed',
        scheduledDate: null,
        scheduledTime: null,
        startedAt: null,
        completedAt: null,
        cardioDate: '2026-05-07',
      },
    ]);

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00',
      userId: 'user-id',
      preferences: preferences(),
    });

    expect(viewModel.fitnessItems).toEqual([
      expect.objectContaining({
        id: 'retro-cardio',
        kind: 'cardio',
        status: 'completed',
      }),
    ]);

    const cardioCall = getAllAsync.mock.calls[1];
    expect(cardioCall).toBeDefined();
    const [query, ...params] = cardioCall as unknown[];
    expect(String(query)).toContain('OR cardioDate = ?');
    expect(String(query)).toContain('OR date(startedAt) = ?');
    expect(String(query)).toContain('OR date(completedAt) = ?');
    expect(params).toEqual([
      'user-id',
      '2026-05-07',
      '2026-05-07',
      '2026-05-07',
      '2026-05-07',
    ]);
  });
});
