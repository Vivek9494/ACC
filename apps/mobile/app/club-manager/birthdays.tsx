import { BirthdaysManagementScreen } from '../../src/components/admin/BirthdaysManagementScreen';

export default function ClubManagerBirthdaysScreen(): React.ReactElement {
  return (
    <BirthdaysManagementScreen userDetailHref={(userId) => `/club-manager/users/${userId}`} />
  );
}
