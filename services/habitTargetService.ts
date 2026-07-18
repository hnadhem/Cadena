import { getDb } from './db';
import {
  HABIT_TARGET_ROW_COLUMNS,
  rowToHabitTarget,
  type HabitTargetRow,
} from './mappers/habitTargetMapper';
import type { HabitTarget } from '../types/schema';

export async function resolveTarget(
  habitId: string,
  date: string
): Promise<HabitTarget | null> {
  const row = await getDb().getFirstAsync<HabitTargetRow>(
    `SELECT ${HABIT_TARGET_ROW_COLUMNS}
    FROM HabitTarget
    WHERE habitId = ?
      AND effectiveFrom <= ?
    ORDER BY effectiveFrom DESC, createdAt DESC, id DESC
    LIMIT 1`,
    habitId,
    date
  );

  return row ? rowToHabitTarget(row) : null;
}

export async function resolveTargets(
  habitIds: string[],
  date: string
): Promise<Map<string, HabitTarget>> {
  const uniqueHabitIds = [...new Set(habitIds)];

  if (uniqueHabitIds.length === 0) {
    return new Map();
  }

  const placeholders = uniqueHabitIds.map(() => '?').join(', ');
  const rows = await getDb().getAllAsync<HabitTargetRow>(
    `SELECT ${HABIT_TARGET_ROW_COLUMNS}
    FROM HabitTarget
    WHERE habitId IN (${placeholders})
      AND effectiveFrom <= ?
    ORDER BY habitId ASC, effectiveFrom DESC, createdAt DESC, id DESC`,
    ...uniqueHabitIds,
    date
  );
  const targetsByHabitId = new Map<string, HabitTarget>();

  for (const row of rows) {
    const target = rowToHabitTarget(row);

    if (!targetsByHabitId.has(target.habitId)) {
      targetsByHabitId.set(target.habitId, target);
    }
  }

  return targetsByHabitId;
}
