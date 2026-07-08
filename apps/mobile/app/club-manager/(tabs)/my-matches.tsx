import { SafeAreaView } from 'react-native-safe-area-context';

import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

/** Club Manager bottom-tab destination — user's matches across tournaments (not tournament-scoped). */
export default function ClubManagerMyMatchesScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <MyMatchesScreen />
    </SafeAreaView>
  );
}
