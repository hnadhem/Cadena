import { describe, expect, it } from '@jest/globals';
import { DailyTag } from '../../constants/enums';
import {
  getTodayCheckInDraftForDate,
  saveTodayCheckInByDate,
  validateTodayCheckInDraft,
  type TodayCheckInSaveResult,
} from '../todayCheckIn';

function expectSaved(result: TodayCheckInSaveResult) {
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result;
}

describe('todayCheckIn', () => {
  it('saves a check-in by date', () => {
    const result = expectSaved(
      saveTodayCheckInByDate({}, '2026-05-07', {
        mood: 'good',
        note: 'Long but steady day.',
        tags: [DailyTag.REST_DAY, DailyTag.BUSY],
      })
    );

    expect(result.checkInsByDate['2026-05-07']).toEqual({
      date: '2026-05-07',
      mood: 'good',
      note: 'Long but steady day.',
      tags: [DailyTag.REST_DAY, DailyTag.BUSY],
    });
  });

  it('prefills same-date data from the saved check-in', () => {
    const saved = expectSaved(
      saveTodayCheckInByDate({}, '2026-05-07', {
        mood: 'bad',
        note: 'Poor sleep.',
        tags: [DailyTag.POOR_SLEEP],
      })
    ).checkInsByDate;

    expect(getTodayCheckInDraftForDate(saved, '2026-05-07')).toEqual({
      mood: 'bad',
      note: 'Poor sleep.',
      tags: [DailyTag.POOR_SLEEP],
    });
  });

  it('keeps different dates isolated', () => {
    const firstSave = expectSaved(
      saveTodayCheckInByDate({}, '2026-05-07', {
        mood: 'okay',
        note: 'First date.',
        tags: [DailyTag.BUSY],
      })
    ).checkInsByDate;

    const secondSave = expectSaved(
      saveTodayCheckInByDate(firstSave, '2026-05-08', {
        mood: 'great',
        note: 'Second date.',
        tags: [DailyTag.SOCIAL_EVENT],
      })
    ).checkInsByDate;

    const updatedFirstDate = expectSaved(
      saveTodayCheckInByDate(secondSave, '2026-05-07', {
        mood: 'terrible',
        note: 'Updated first date.',
        tags: [DailyTag.SICK],
      })
    ).checkInsByDate;

    expect(updatedFirstDate['2026-05-07']).toMatchObject({
      mood: 'terrible',
      note: 'Updated first date.',
      tags: [DailyTag.SICK],
    });
    expect(updatedFirstDate['2026-05-08']).toMatchObject({
      mood: 'great',
      note: 'Second date.',
      tags: [DailyTag.SOCIAL_EVENT],
    });
  });

  it('rejects tags outside the fixed DailyTag list', () => {
    const validation = validateTodayCheckInDraft({
      note: '',
      tags: ['unknown_tag' as DailyTag],
    });

    expect(validation).toEqual({
      ok: false,
      error: 'Choose only supported context tags.',
    });
  });

  it('allows an empty save as a checked-in state', () => {
    const result = expectSaved(
      saveTodayCheckInByDate({}, '2026-05-07', {
        note: '',
        tags: [],
      })
    );

    expect(result.checkInsByDate['2026-05-07']).toEqual({
      date: '2026-05-07',
    });
  });
});
