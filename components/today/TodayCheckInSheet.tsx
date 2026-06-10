import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { DailyTag } from '../../constants/enums';
import {
  TODAY_CHECK_IN_MOODS,
  TODAY_CHECK_IN_MORE_TAGS,
  TODAY_CHECK_IN_PRIMARY_TAGS,
  TODAY_CHECK_IN_TAG_LABELS,
  type TodayCheckInDraft,
  type TodayCheckInEntry,
  type TodayCheckInMood,
  validateTodayCheckInDraft,
} from '../../utils/todayCheckIn';

interface TodayCheckInSheetProps {
  visible: boolean;
  date: string;
  value?: TodayCheckInEntry;
  onClose: () => void;
  onSave: (draft: TodayCheckInDraft) => void;
}

const MOOD_LABELS: Record<TodayCheckInMood, string> = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  bad: 'Bad',
  terrible: 'Terrible',
};

const moreTags = TODAY_CHECK_IN_MORE_TAGS as readonly DailyTag[];

export function TodayCheckInSheet({
  visible,
  date,
  value,
  onClose,
  onSave,
}: TodayCheckInSheetProps) {
  const [mood, setMood] = useState<TodayCheckInMood | undefined>();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<DailyTag[]>([]);
  const [showMoreTags, setShowMoreTags] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    const nextTags = value?.tags ?? [];
    setMood(value?.mood);
    setNote(value?.note ?? '');
    setTags(nextTags);
    setShowMoreTags(nextTags.some((tag) => moreTags.includes(tag)));
    setError(null);
  }, [date, value, visible]);

  function handleMoodPress(nextMood: TodayCheckInMood) {
    setMood((currentMood) => (currentMood === nextMood ? undefined : nextMood));
    setError(null);
  }

  function handleTagPress(tag: DailyTag) {
    setTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
    setError(null);
  }

  function handleSave() {
    const draft: TodayCheckInDraft = { mood, note, tags };
    const validation = validateTodayCheckInDraft(draft);

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    onSave(draft);
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Check-in</Text>
              <Text style={styles.dateLabel}>{date}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close check-in"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.textSecondaryLight} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mood</Text>
              <View style={styles.optionGrid}>
                {TODAY_CHECK_IN_MOODS.map((moodOption) => {
                  const selected = mood === moodOption;

                  return (
                    <Pressable
                      key={moodOption}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => handleMoodPress(moodOption)}
                      style={({ pressed }) => [
                        styles.optionChip,
                        selected && styles.selectedChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.selectedChipLabel,
                        ]}
                      >
                        {MOOD_LABELS[moodOption]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                multiline
                value={note}
                onChangeText={(nextNote) => {
                  setNote(nextNote);
                  setError(null);
                }}
                placeholder="Optional note"
                placeholderTextColor={colors.textTertiaryLight}
                style={styles.noteInput}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Context</Text>
              <View style={styles.optionGrid}>
                {TODAY_CHECK_IN_PRIMARY_TAGS.map((tag) => (
                  <TagChip
                    key={tag}
                    tag={tag}
                    selected={tags.includes(tag)}
                    onPress={handleTagPress}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowMoreTags((showMore) => !showMore)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    styles.moreChip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.moreLabel}>
                    {showMoreTags ? 'Less' : 'More'}
                  </Text>
                  <Ionicons
                    name={showMoreTags ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.brand600}
                  />
                </Pressable>
              </View>

              {showMoreTags && (
                <View style={[styles.optionGrid, styles.moreGrid]}>
                  {TODAY_CHECK_IN_MORE_TAGS.map((tag) => (
                    <TagChip
                      key={tag}
                      tag={tag}
                      selected={tags.includes(tag)}
                      onPress={handleTagPress}
                    />
                  ))}
                </View>
              )}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="secondary" />
            <Button label="Save" onPress={handleSave} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TagChip({
  tag,
  selected,
  onPress,
}: {
  tag: DailyTag;
  selected: boolean;
  onPress: (tag: DailyTag) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(tag)}
      style={({ pressed }) => [
        styles.optionChip,
        selected && styles.selectedChip,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionLabel, selected && styles.selectedChipLabel]}>
        {TODAY_CHECK_IN_TAG_LABELS[tag]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sheet: {
    maxHeight: '88%',
    gap: spacing[4],
    padding: spacing[4],
    paddingBottom: spacing[5],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surfaceLight,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  dateLabel: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.neutral100,
  },
  content: {
    gap: spacing[5],
  },
  field: {
    gap: spacing[2],
  },
  fieldLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  moreGrid: {
    marginTop: spacing[2],
  },
  optionChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  selectedChip: {
    borderColor: colors.brand600,
    backgroundColor: colors.classic.over_thresholdSurface,
  },
  moreChip: {
    borderColor: colors.brand600,
  },
  optionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondaryLight,
  },
  selectedChipLabel: {
    color: colors.brand700,
  },
  moreLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.brand600,
  },
  noteInput: {
    minHeight: 96,
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.neutral50,
    fontSize: typography.size.base,
    color: colors.textPrimaryLight,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.muted.missed,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  pressed: {
    opacity: 0.75,
  },
});
