import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy route — canonical registration screen lives at `/register`. */
export default function RegistrationIndexRedirect(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  if (!tournamentId) {
    return <Redirect href="/" />;
  }
  return <Redirect href={`/registrations/${tournamentId}/register`} />;
}
