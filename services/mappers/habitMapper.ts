import type { Habit } from '../../types/schema';
import {
  booleanToInt,
  readBooleanInt,
  readNullableString,
  readNumber,
  readRowObject,
  readString,
} from './mapperUtils';

const TABLE = 'Habit';

export interface HabitRow {
  id: string;
  userId: string;
  parentHabitId: string | null;
  name: string;
  description: string | null;
  category: string | null;
  color: string | null;
  icon: string | null;
  isHidden: number;
  trackEffort: number;
  startDate: string;
  allowMultiplePerDay: number;
  displayOrder: number;
  isPinned: number;
  archivedAt: string | null;
  linkedTallyItemId: string | null;
  createdAt: string;
}

export function rowToHabit(row: unknown): Habit {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    userId: readString(record, TABLE, 'userId'),
    parentHabitId: readNullableString(record, TABLE, 'parentHabitId'),
    name: readString(record, TABLE, 'name'),
    description: readNullableString(record, TABLE, 'description'),
    category: readNullableString(record, TABLE, 'category'),
    color: readNullableString(record, TABLE, 'color'),
    icon: readNullableString(record, TABLE, 'icon'),
    isHidden: readBooleanInt(record, TABLE, 'isHidden'),
    trackEffort: readBooleanInt(record, TABLE, 'trackEffort'),
    startDate: readString(record, TABLE, 'startDate'),
    allowMultiplePerDay: readBooleanInt(record, TABLE, 'allowMultiplePerDay'),
    displayOrder: readNumber(record, TABLE, 'displayOrder'),
    isPinned: readBooleanInt(record, TABLE, 'isPinned'),
    archivedAt: readNullableString(record, TABLE, 'archivedAt'),
    linkedTallyItemId: readNullableString(record, TABLE, 'linkedTallyItemId'),
    createdAt: readString(record, TABLE, 'createdAt'),
  };
}

export function habitToRow(habit: Habit): HabitRow {
  return {
    id: habit.id,
    userId: habit.userId,
    parentHabitId: habit.parentHabitId ?? null,
    name: habit.name,
    description: habit.description ?? null,
    category: habit.category ?? null,
    color: habit.color ?? null,
    icon: habit.icon ?? null,
    isHidden: booleanToInt(habit.isHidden),
    trackEffort: booleanToInt(habit.trackEffort),
    startDate: habit.startDate,
    allowMultiplePerDay: booleanToInt(habit.allowMultiplePerDay),
    displayOrder: habit.displayOrder,
    isPinned: booleanToInt(habit.isPinned),
    archivedAt: habit.archivedAt ?? null,
    linkedTallyItemId: habit.linkedTallyItemId ?? null,
    createdAt: habit.createdAt,
  };
}
