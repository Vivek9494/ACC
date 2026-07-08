import { useLocalSearchParams } from 'expo-router';

import { AdminUserDetailView } from '../../../src/components/admin/AdminUserDetailView';

export default function AdminUserDetailScreen(): React.ReactElement {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  return (
    <AdminUserDetailView
      userId={userId}
      manageUsers
      editUserHref={(id) => `/admin/users/${id}/edit`}
    />
  );
}
