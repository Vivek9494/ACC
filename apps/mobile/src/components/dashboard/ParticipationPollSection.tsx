import {
  PollVoteChoice,
  type ParticipationPollCardView,
  type PollVoteChoice as PollVoteChoiceType,
} from '@acc/types';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiRequestError, submitParticipationPollVote } from '../../lib/api';
import { formatPollCloseLine } from '../../lib/venue-time';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

const CHOICE_LABEL: Record<PollVoteChoiceType, string> = {
  [PollVoteChoice.In]: "Yes, I'm IN",
  [PollVoteChoice.Out]: "No, I'm OUT",
};

function ChoiceOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`flex-1 rounded-control border px-3 py-3 ${
        selected
          ? 'border-primary bg-primary-container'
          : 'border-outline-variant bg-surface'
      } ${disabled ? 'opacity-70' : 'active:opacity-90'}`}
    >
      <Text
        className={`text-center font-sans-semibold text-sm ${
          selected ? 'text-primary' : 'text-on-surface'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface ParticipationPollSectionProps {
  poll: ParticipationPollCardView;
  onPollUpdated: () => void;
}

/** Inline poll voting UI — embedded in the captain upcoming match card. */
export function ParticipationPollSection({
  poll: initialPoll,
  onPollUpdated,
}: ParticipationPollSectionProps): React.ReactElement {
  const [poll, setPoll] = useState(initialPoll);
  const [selected, setSelected] = useState<PollVoteChoiceType | null>(initialPoll.userVote);
  const [editing, setEditing] = useState(initialPoll.userVote == null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setPoll(initialPoll);
    setSelected(initialPoll.userVote);
    setEditing(initialPoll.userVote == null);
  }, [initialPoll]);

  const hasVote = poll.userVote != null;
  const optionsEnabled = poll.isOpen && editing;
  const showChoices = poll.isOpen && (!hasVote || editing);
  const confirmEnabled =
    poll.isOpen &&
    editing &&
    selected != null &&
    (poll.userVote == null || selected !== poll.userVote);
  const showConfirm = poll.isOpen && editing;
  const showEdit = poll.isOpen && hasVote && !editing;

  async function handleConfirm(): Promise<void> {
    if (!selected || !poll.isOpen) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const updated = await submitParticipationPollVote(poll.pollId, { choice: selected });
      setPoll(updated);
      setSelected(updated.userVote);
      setEditing(false);
      onPollUpdated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save your vote.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <View className="gap-3 border-b border-outline-variant/60 pb-4">
      <Text className="font-sans-bold text-sm uppercase tracking-wider text-on-surface">
        Are you playing?
      </Text>

      {showChoices ? (
        <View className="flex-row gap-2">
          <ChoiceOption
            label={CHOICE_LABEL[PollVoteChoice.In]}
            selected={selected === PollVoteChoice.In}
            disabled={!optionsEnabled}
            onPress={() => setSelected(PollVoteChoice.In)}
          />
          <ChoiceOption
            label={CHOICE_LABEL[PollVoteChoice.Out]}
            selected={selected === PollVoteChoice.Out}
            disabled={!optionsEnabled}
            onPress={() => setSelected(PollVoteChoice.Out)}
          />
        </View>
      ) : (
        <View className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-3">
          <Text className="font-sans-semibold text-sm text-on-surface">
            {poll.userVote ? CHOICE_LABEL[poll.userVote] : '—'}
          </Text>
        </View>
      )}

      {!poll.isOpen ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          Poll closed
          {poll.closesAt
            ? ` • closed ${formatPollCloseLine(poll.closesAt, poll.timezone, poll.timezoneFallback)}`
            : ''}
        </Text>
      ) : poll.closesAt ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          Closes {formatPollCloseLine(poll.closesAt, poll.timezone, poll.timezoneFallback)}
        </Text>
      ) : null}

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

      {showConfirm ? (
        <Button
          label={working ? 'Saving…' : 'Confirm'}
          disabled={!confirmEnabled || working}
          onPress={() => void handleConfirm()}
          className="h-12 w-full"
        />
      ) : null}

      {showEdit ? (
        <Button
          label="Edit"
          variant="outline"
          onPress={() => {
            setEditing(true);
            setSelected(poll.userVote);
          }}
          className="h-12 w-full border-primary"
          textClassName="text-primary"
        />
      ) : null}

      <Pressable
        onPress={() => router.push(`/participation-polls/${poll.pollId}/results` as Href)}
        accessibilityRole="button"
        className="items-center py-1 active:opacity-80"
      >
        <Text className="font-sans-semibold text-sm text-primary">View Poll</Text>
      </Pressable>
    </View>
  );
}
