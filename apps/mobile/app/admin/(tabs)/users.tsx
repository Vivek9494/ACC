import { AdminUsersDirectoryScreen } from '../../../src/components/admin/AdminUsersDirectoryScreen';

export default function AdminUsersTabScreen(): React.ReactElement {
  return (
    <AdminUsersDirectoryScreen
      manageUsers
      newUserHref="/admin/users/new"
      userDetailHref={(userId) => `/admin/users/${userId}`}
    />
  );
}
