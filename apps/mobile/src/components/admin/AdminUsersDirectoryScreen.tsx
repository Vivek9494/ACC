import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUserSummary,
  type AdminUsersPage,
  type ListAdminUsersParams,
} from '@acc/types';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminUserListCard } from './AdminUserListCard';
import { CircularAddButton } from '../ui/CircularAddButton';
import { KeyboardAwareFormContainer } from '../ui/KeyboardAwareFormScrollView';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import {
  ApiRequestError,
  deleteAdminUser,
  getCenters,
  getProvinces,
  listAdminUsers,
  listCentersAdmin,
  listProvincesAdmin,
  updateAdminUserStatus,
} from '../../lib/api';
import { confirmActionAlert } from '../../lib/confirm-action-alert';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';

const SEARCH_DEBOUNCE_MS = 350;
const ALL_FILTER_VALUE = '';

interface GeoProvince {
  id: string;
  name: string;
}

interface GeoCenter {
  id: string;
  name: string;
  provinceId: string;
}

interface UserListFilters {
  provinceId: string | null;
  centerId: string | null;
}

export interface AdminUsersDirectoryScreenProps {
  /** When true, show create/edit/delete affordances and load admin geography APIs. */
  manageUsers: boolean;
  userDetailHref: (userId: string) => Href;
  newUserHref?: Href;
}

/** System-wide user directory — full management for Admin, view-only for Club Manager. */
export function AdminUsersDirectoryScreen({
  manageUsers,
  userDetailHref,
  newUserHref,
}: AdminUsersDirectoryScreenProps): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<GeoProvince[]>([]);
  const [centers, setCenters] = useState<GeoCenter[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const filters: UserListFilters = useMemo(
    () => ({ provinceId, centerId }),
    [centerId, provinceId],
  );
  const hasActiveFilters = provinceId != null || centerId != null;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const loadGeography = useCallback(() => {
    setGeoLoading(true);
    setGeoError(null);
    const loader = manageUsers
      ? Promise.all([listProvincesAdmin(), listCentersAdmin()]).then(
          ([provinceRows, centerRows]) => {
            setProvinces(provinceRows.map((row) => ({ id: row.id, name: row.name })));
            setCenters(
              centerRows.map((row) => ({
                id: row.id,
                name: row.name,
                provinceId: row.provinceId,
              })),
            );
          },
        )
      : Promise.all([getProvinces(), getCenters()]).then(([provinceRows, centerRows]) => {
          setProvinces(provinceRows);
          setCenters(centerRows);
        });

    return loader
      .catch((err: unknown) => {
        setGeoError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not load province and center filters.',
        );
      })
      .finally(() => setGeoLoading(false));
  }, [manageUsers]);

  useEffect(() => {
    void loadGeography();
  }, [loadGeography]);

  const provinceOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'All provinces' },
      ...provinces.map((province) => ({ value: province.id, label: province.name })),
    ],
    [provinces],
  );

  const centerOptions = useMemo(() => {
    const pool = provinceId
      ? centers.filter((center) => center.provinceId === provinceId)
      : centers;
    return [
      { value: ALL_FILTER_VALUE, label: 'All centers' },
      ...pool.map((center) => ({ value: center.id, label: center.name })),
    ];
  }, [centers, provinceId]);

  const loadPage = useCallback(
    async (
      mode: 'reset' | 'more',
      query: string,
      activeFilters: UserListFilters,
      cursor: string | null,
    ) => {
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
          provinceId: activeFilters.provinceId ?? undefined,
          centerId: activeFilters.centerId ?? undefined,
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

  useFocusEffect(
    useCallback(() => {
      void loadPage('reset', debouncedSearch, filters, null);
    }, [debouncedSearch, filters, loadPage]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPage('reset', debouncedSearch, filters, null);
  }, [debouncedSearch, filters, loadPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || !nextCursor) {
      return;
    }
    void loadPage('more', debouncedSearch, filters, nextCursor);
  }, [debouncedSearch, filters, loadPage, loading, loadingMore, nextCursor]);

  function handleProvinceChange(value: string): void {
    const nextProvinceId = value === ALL_FILTER_VALUE ? null : value;
    setProvinceId(nextProvinceId);
    if (nextProvinceId && centerId) {
      const selectedCenter = centers.find((center) => center.id === centerId);
      if (selectedCenter && selectedCenter.provinceId !== nextProvinceId) {
        setCenterId(null);
      }
    }
  }

  function handleCenterChange(value: string): void {
    const nextCenterId = value === ALL_FILTER_VALUE ? null : value;
    setCenterId(nextCenterId);
    if (nextCenterId) {
      const selectedCenter = centers.find((center) => center.id === nextCenterId);
      if (selectedCenter) {
        setProvinceId(selectedCenter.provinceId);
      }
    }
  }

  function clearFilters(): void {
    setProvinceId(null);
    setCenterId(null);
  }

  async function applyStatusChange(user: AdminUserSummary, nextActive: boolean): Promise<void> {
    setActionError(null);
    try {
      const updated = await updateAdminUserStatus(user.id, { isActive: nextActive });
      setItems((current) =>
        current.map((row) =>
          row.id === user.id ? { ...row, isActive: updated.isActive } : row,
        ),
      );
    } catch (err) {
      console.error('Failed to update user status', err);
      setActionError("Couldn't update status. Please try again.");
    }
  }

  function requestToggleStatus(user: AdminUserSummary): void {
    const displayName = `${user.firstName} ${user.lastName}`.trim();
    if (user.isActive) {
      confirmActionAlert({
        title: `Deactivate ${displayName}?`,
        message:
          "They won't be able to log in and won't appear in invites, rosters, or team selection. You can reactivate them later.",
        confirmLabel: 'Deactivate',
        onConfirm: () => applyStatusChange(user, false),
      });
      return;
    }
    confirmActionAlert({
      title: `Reactivate ${displayName}?`,
      message: "They'll be able to log in and appear in selection lists again.",
      confirmLabel: 'Reactivate',
      onConfirm: () => applyStatusChange(user, true),
    });
  }

  function requestDeleteUser(user: AdminUserSummary): void {
    const displayName = `${user.firstName} ${user.lastName}`.trim();
    confirmDestructiveDeleteAlert({
      title: `Delete ${displayName}?`,
      message: "This can't be undone.",
      onConfirm: async () => {
        try {
          await deleteAdminUser(user.id);
          setItems((current) => current.filter((row) => row.id !== user.id));
        } catch (err) {
          Alert.alert(
            'Could not delete user',
            err instanceof ApiRequestError ? err.message : 'Delete failed.',
          );
        }
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareFormContainer>
        <View className="z-10 bg-background px-4 pb-4 pt-4">
          <View className="flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-3">
              <Text className="font-sans-bold text-2xl text-text">Users</Text>
              <Text className="mt-1 font-sans text-sm text-text-muted">
                System-wide user directory
              </Text>
            </View>
            {manageUsers && newUserHref ? (
              <CircularAddButton
                accessibilityLabel="Add user"
                onPress={() => router.push(newUserHref)}
              />
            ) : null}
          </View>
          <View className="mt-4 flex-row gap-3">
            <View className="min-w-0 flex-1">
              <Select
                label="Province"
                placeholder="All provinces"
                value={provinceId ?? ALL_FILTER_VALUE}
                options={provinceOptions}
                onChange={handleProvinceChange}
                loading={geoLoading}
                disabled={geoLoading}
                error={geoError}
                onRetry={() => void loadGeography()}
                emptyMessage="No provinces found"
              />
            </View>
            <View className="min-w-0 flex-1">
              <Select
                label="Center"
                placeholder="All centers"
                value={centerId ?? ALL_FILTER_VALUE}
                options={centerOptions}
                onChange={handleCenterChange}
                loading={geoLoading}
                disabled={geoLoading}
                emptyMessage={
                  provinceId ? 'No centers in this province' : 'No centers found'
                }
              />
            </View>
          </View>
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} className="mt-2 self-start py-1">
              <Text className="font-sans-semibold text-sm text-primary">Clear filters</Text>
            </Pressable>
          ) : null}
          <TextInput
            containerClassName="mt-1"
            placeholder="Search by name or mobile number…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {actionError ? (
            <Text className="mt-2 font-sans text-sm text-primary">{actionError}</Text>
          ) : null}
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
            contentContainerClassName="gap-3 px-4 pb-10"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AdminUserListCard
                user={item}
                showRowActions={manageUsers}
                onPress={() => router.push(userDetailHref(item.id))}
                onToggleStatus={() => requestToggleStatus(item)}
                onDelete={() => requestDeleteUser(item)}
              />
            )}
            ListEmptyComponent={
              !loading ? (
                <Text className="py-16 text-center font-sans text-base text-text-muted">
                  No users match your search or filters.
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
      </KeyboardAwareFormContainer>
    </SafeAreaView>
  );
}
