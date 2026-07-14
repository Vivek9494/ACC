import { Stack } from 'expo-router';

/** Tournaments tab stack — list, detail, and nested tournament flow screens. */
export default function TournamentsStackLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
