import { CaptainTabShell } from '../../../src/components/dashboard/CaptainTabShell';
import { Text } from '../../../src/components/ui/Text';

export default function CaptainMessagesScreen(): React.ReactElement {
  return (
    <CaptainTabShell activeKey="messages">
      <Text className="px-4 pt-4 font-sans-bold text-xl text-on-surface">Messages</Text>
      <Text className="mt-2 px-4 font-sans text-sm text-on-surface-variant">Coming soon.</Text>
    </CaptainTabShell>
  );
}
