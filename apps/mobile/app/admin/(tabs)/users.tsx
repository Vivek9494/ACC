import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUserSummary,
  type AdminUsersPage,
  type ListAdminUsersParams,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminUserListCard } from '../../../src/components/admin/AdminUserListCard';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, listAdminUsers } from '../../../src/lib/api';

const SEARCH_DEBOUNCE_MS = 350;

export default function AdminUsersTabScreen(): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(
    async (mode: 'reset' | 'more', query: string, cursor: string | null) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === 'reset') {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params: ListAdminUsersParams = {
          q: query.trim() || undefined,
          limit: ADMIN_USERS_PAGE_SIZE,
          ...(mode === 'more' && cursor ? { cursor } : {}),
        };
        const page: AdminUsersPage = await listAdminUsers(params);
        if (requestIdRef.current !== requestId) {
          return;
        }
        setItems((current) => (mode === 'reset' ? page.items : [...current, ...page.items]));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (err) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        if (mode === 'reset') {
          setItems([]);
          setNextCursor(null);
        }
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'You do not have permission to view users.',
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadPage('reset', debouncedSearch, null);
  }, [debouncedSearch, loadPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPage('reset', debouncedSearch, null);
  }, [debouncedSearch, loadPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || !nextCursor) {
      return;
    }
    void loadPage('more', debouncedSearch, nextCursor);
  }, [debouncedSearch, loadPage, loading, loadingMore, nextCursor]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4">
        <Text className="font-sans-bold text-2xl text-text">Users</Text>
        <Text className="mt-1 font-sans text-sm text-text-muted">
          System-wide user directory
        </Text>
        <TextInput
          containerClassName="mt-4"
          placeholder="Search by name or mobile number…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error && items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-primary">{error}</Text>
        </View>
      ) : null}

      {!error || items.length > 0 ? (
        <FlatList
          className="flex-1"
          contentContainerClassName="gap-3 px-4 pb-10 pt-4"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AdminUserListCard
              user={item}
              onPress={() => router.push(`/admin/users/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <Text className="py-16 text-center font-sans text-base text-text-muted">
                No users match your search.
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <ActivityIndicator color={FIELD_ORANGE} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIELD_ORANGE} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
        />
      ) : null}
    </SafeAreaView>
  );
}
