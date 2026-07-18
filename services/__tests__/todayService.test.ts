import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { AppMode, EnabledModule, FrequencyType } from '../../constants/enums';
import { useHabitStore } from '../../store/habitStore';
import { useUserStore } from '../../store/userStore';
import type { Habit, HabitLog, HabitTarget, UserPreferences } from '../../types/schema';
import { getDb } from '../db';
import {
  completeTodayHabit,
  getTodayViewModel,
  moveTodayFitnessSessionToTomorrow,
  saveTodayHabitValue,
  undoTodayHabitCompletion,
} from '../todayService';

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

function habitTarget(overrides: Partial<HabitTarget>): HabitTarget {
  return {
    id: overrides.id ?? 'target-id',
    habitId: overrides.habitId ?? 'habit-id',
    frequencyType: overrides.frequencyType ?? FrequencyType.DAILY,
    timesPerDay: overrides.timesPerDay,
    intervalDays: overrides.intervalDays,
    daysOfWeek: overrides.daysOfWeek,
    timesPerWeek: overrides.timesPerWeek,
    intervalWeeks: overrides.intervalWeeks,
    timesPerMonth: overrides.timesPerMonth,
    daysOfMonth: overrides.daysOfMonth,
    timesPerYear: overrides.timesPerYear,
    scheduledTime: overrides.scheduledTime,
    weekStartDay: overrides.weekStartDay ?? 0,
    habitType: overrides.habitType ?? 'binary',
    targetValue: overrides.targetValue,
    targetUnit: overrides.targetUnit,
    directionality: overrides.directionality,
    streakCompletionThreshold: overrides.streakCompletionThreshold,
    autoCompleteThreshold: overrides.autoCompleteThreshold,
    effectiveFrom: overrides.effectiveFrom ?? '2026-05-01',
    createdAt: overrides.createdAt ?? '2026-05-01T12:00:00',
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
    useHabitStore.setState({ habits: [], todayLogs: [], habitTargets: [] });
    useUserStore.setState({
      userId: null,
      timezone: 'UTC',
      appMode: AppMode.COMBINED,
      preferences: null,
    });
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

  it('uses the user timezone and dayEndTime for unselected Today composition', async () => {
    useUserStore.setState({ timezone: 'America/New_York' });

    const viewModel = await getTodayViewModel({
      currentDate: '2026-05-08T06:59:59.000Z',
      userId: null,
      preferences: preferences({ dayEndTime: '03:00' }),
    });

    expect(viewModel).toMatchObject({
      selectedDate: '2026-05-07',
      title: 'Today',
      subtitle: 'May 7',
    });
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

  it('adds target, schedule, value, and streak metadata to habit items', async () => {
    useHabitStore.getState().loadHabits(
      [habit({ id: 'water', name: 'Water' })],
      [
        habitLog({
          id: 'water-log-1',
          habitId: 'water',
          date: '2026-05-06',
          completed: true,
          value: 64,
        }),
        habitLog({
          id: 'water-log-2',
          habitId: 'water',
          date: '2026-05-07',
          completed: true,
          value: 72,
          completedAt: '2026-05-07T09:00:00',
        }),
      ],
      [
        habitTarget({
          id: 'water-target',
          habitId: 'water',
          habitType: 'measurable',
          targetValue: 64,
          targetUnit: 'oz',
          scheduledTime: '08:00',
        }),
      ]
    );

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00',
      userId: null,
      preferences: preferences(),
    });

    expect(viewModel.habitItems).toEqual([
      expect.objectContaining({
        habitId: 'water',
        status: 'completed',
        habitType: 'measurable',
        scheduledTime: '08:00',
        value: 72,
        targetValue: 64,
        targetUnit: 'oz',
        streakCount: 2,
      }),
    ]);
  });

  it('completes a binary habit and supports undoing the new log', () => {
    useHabitStore.getState().loadHabits([habit({ id: 'walk' })], []);

    const result = completeTodayHabit('walk', '2026-05-07', '2026-05-07T08:00:00');

    expect(result).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'walk',
        date: '2026-05-07',
        completed: true,
        completedAt: '2026-05-07T08:00:00',
      }),
    });

    const logId = result.ok ? result.log.id : '';
    expect(useHabitStore.getState().todayLogs).toHaveLength(1);

    expect(undoTodayHabitCompletion(logId)).toEqual({ ok: true, logId });
    expect(useHabitStore.getState().todayLogs).toHaveLength(0);
  });

  it('saves measurable habit values and completes them only when the target is met', () => {
    useHabitStore.getState().loadHabits(
      [habit({ id: 'water' })],
      [],
      [
        habitTarget({
          id: 'water-target',
          habitId: 'water',
          habitType: 'measurable',
          targetValue: 64,
          targetUnit: 'oz',
        }),
      ]
    );

    const partialResult = saveTodayHabitValue(
      'water',
      '2026-05-07',
      32,
      '2026-05-07T08:00:00'
    );

    expect(partialResult).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'water',
        completed: false,
        value: 32,
        completedAt: undefined,
      }),
    });

    const completeResult = saveTodayHabitValue(
      'water',
      '2026-05-07',
      64,
      '2026-05-07T09:00:00'
    );

    expect(completeResult).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'water',
        completed: true,
        value: 64,
        completedAt: '2026-05-07T09:00:00',
      }),
    });
    expect(useHabitStore.getState().todayLogs).toHaveLength(1);
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

  it('moves a fitness session to the next calendar date without timestamp arithmetic', async () => {
    const getFirstAsync = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const runAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
    getFirstAsync.mockResolvedValueOnce({
      id: 'session-id',
      status: 'planned',
      templateId: null,
      name: null,
    });
    runAsync.mockResolvedValueOnce(undefined);
    mockGetDb.mockReturnValue({
      getFirstAsync,
      runAsync,
    } as unknown as ReturnType<typeof getDb>);

    await expect(
      moveTodayFitnessSessionToTomorrow('workout', 'session-id', '2026-12-31')
    ).resolves.toEqual({
      ok: true,
      kind: 'workout',
      sessionId: 'session-id',
      destinationDate: '2027-01-01',
    });
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE WorkoutSession SET scheduledDate = ? WHERE id = ?'),
      '2027-01-01',
      'session-id'
    );
  });
});
