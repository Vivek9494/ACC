import { SafeAreaView } from 'react-native-safe-area-context';

import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

export default function PlayerMatchesScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <MyMatchesScreen />
    </SafeAreaView>
  );
}
