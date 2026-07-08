import { formatMatchTossSummaryLine, type MatchDetail } from '@acc/types';

import { Text } from '../ui/Text';

export function MatchTossSummaryLine({
  match,
}: {
  match: MatchDetail | null | undefined;
}): React.ReactElement | null {
  const line = match ? formatMatchTossSummaryLine(match) : null;
  if (!line) {
    return null;
  }

  return <Text className="font-sans-semibold text-sm text-tertiary">{line}</Text>;
}
