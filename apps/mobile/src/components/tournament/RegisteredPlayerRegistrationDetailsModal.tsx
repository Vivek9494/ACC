import {
  buildRegistrationSkillAssessmentChipLabels,
  registrationBattingHandShortLabel,
  registrationPlayerRoleLabel,
  type RegistrationSummary,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { PlayerAvatar } from './PlayerAvatar';
import { TournamentDetailInfoRow } from '../ui/TournamentDetailSectionCard';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface RegisteredPlayerRegistrationDetailsModalProps {
  visible: boolean;
  player: RegistrationSummary | null;
  onClose: () => void;
}

function SkillAssessmentChips({ labels }: { labels: string[] }): React.ReactElement {
  return (
    <View className="flex-row flex-wrap gap-2">
      {labels.map((label) => (
        <View key={label} className="rounded-control border border-primary/20 bg-primary-50 px-3 py-1.5">
          <Text className="font-sans-semibold text-sm text-secondary">{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Read-only registration details for a registered player (§7.1 fields). */
export function RegisteredPlayerRegistrationDetailsModal({
  visible,
  player,
  onClose,
}: RegisteredPlayerRegistrationDetailsModalProps): React.ReactElement {
  const playerRole = player ? registrationPlayerRoleLabel(player.playerRole) : null;
  const battingHand = player ? registrationBattingHandShortLabel(player.battingStyle) : null;
  const skillAssessmentChips = player ? buildRegistrationSkillAssessmentChipLabels(player) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-surface p-5"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-start justify-between gap-3">
            <Text className="min-w-0 flex-1 font-sans-bold text-lg text-on-surface">
              Registration Details
            </Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close registration details"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          {player ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View className="flex-row items-center gap-4">
                  <PlayerAvatar
                    firstName={player.firstName}
                    profilePhotoUrl={player.profilePhotoUrl}
                    size="lg"
                    shape="circle"
                  />
                  <Text className="min-w-0 flex-1 font-sans-bold text-xl text-on-surface">
                    {player.firstName} {player.lastName}
                  </Text>
                </View>

                <View className="gap-4">
                  {player.centerName ? (
                    <TournamentDetailInfoRow label="Center" value={player.centerName} />
                  ) : null}
                  {playerRole ? (
                    <TournamentDetailInfoRow label="Player Role" value={playerRole} />
                  ) : null}
                  {battingHand ? (
                    <TournamentDetailInfoRow label="Batting Hand" value={battingHand} />
                  ) : null}
                  {skillAssessmentChips.length > 0 ? (
                    <View className="gap-2">
                      <Text className="font-sans text-sm text-on-surface-variant">
                        Skill Assessment
                      </Text>
                      <SkillAssessmentChips labels={skillAssessmentChips} />
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
