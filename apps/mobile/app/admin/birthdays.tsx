import { BirthdaysManagementScreen } from '../../src/components/admin/BirthdaysManagementScreen';

export default function AdminBirthdaysScreen(): React.ReactElement {
  return <BirthdaysManagementScreen userDetailHref={(userId) => `/admin/users/${userId}`} />;
}
