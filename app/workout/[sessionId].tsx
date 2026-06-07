import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '../../components/shared/PlaceholderScreen';

export default function WorkoutSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const resolvedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;

  return (
    <PlaceholderScreen
      title="Workout Session"
      message="Workout start, resume, and history flows will be available here."
      detail={resolvedSessionId ? `Session ID: ${resolvedSessionId}` : undefined}
    />
  );
}
