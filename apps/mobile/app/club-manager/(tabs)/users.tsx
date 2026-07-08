import { AdminUsersDirectoryScreen } from '../../../src/components/admin/AdminUsersDirectoryScreen';

export default function ClubManagerUsersTabScreen(): React.ReactElement {
  return (
    <AdminUsersDirectoryScreen
      manageUsers={false}
      userDetailHref={(userId) => `/club-manager/users/${userId}`}
    />
  );
}
