/**
 * THROWAWAY geofence proof-of-concept screen (§geofence attendance spike).
 *
 * Validates, on a physical device, that we can: (1) request foreground then
 * background ("Always") location correctly on iOS & Android, (2) monitor a 50 m
 * geofence around a hardcoded point, and (3) log an "entered" event with a
 * timestamp when the boundary is crossed. Delete once the spike is signed off.
 *
 * REQUIRES A DEV BUILD — geofencing/TaskManager do not run in Expo Go.
 */
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearLog,
  GEOFENCE_REGION_ID,
  GEOFENCE_TASK,
  type GeofenceLogEntry,
  readLog,
} from '../src/geofence/geofence-task';

// ⬇️ HARDCODED geofence centre — replace with your test spot, or tap
// "Centre on my current GPS" below to set it to where you're standing.
const DEFAULT_CENTER = { latitude: 37.33182, longitude: -122.03118 }; // Apple Park
const RADIUS_METERS = 50;

// Show notifications even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Perm = 'unknown' | 'granted' | 'denied';

export default function GeofencePocScreen(): React.ReactElement {
  const router = useRouter();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [fg, setFg] = useState<Perm>('unknown');
  const [bg, setBg] = useState<Perm>('unknown');
  const [monitoring, setMonitoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<GeofenceLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLog(await readLog());
    setMonitoring(await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false));
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function ensurePermissions(): Promise<boolean> {
    // iOS & Android both require foreground ("When In Use") to be granted FIRST.
    const fgRes = await Location.requestForegroundPermissionsAsync();
    setFg(fgRes.status === 'granted' ? 'granted' : 'denied');
    if (fgRes.status !== 'granted') {
      setError('Foreground location denied. Geofencing needs location access.');
      return false;
    }
    // Then background ("Always" on iOS; "Allow all the time" on Android 10+).
    const bgRes = await Location.requestBackgroundPermissionsAsync();
    setBg(bgRes.status === 'granted' ? 'granted' : 'denied');
    if (bgRes.status !== 'granted') {
      setError(
        'Background location not granted. Open Settings → ACC → Location and choose ' +
          '"Always" (iOS) / "Allow all the time" (Android), then start again.',
      );
      return false;
    }
    // Local notifications give immediate feedback when a boundary is crossed.
    await Notifications.requestPermissionsAsync();
    return true;
  }

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!(await ensurePermissions())) return;
      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: GEOFENCE_REGION_ID,
          latitude: center.latitude,
          longitude: center.longitude,
          radius: RADIUS_METERS,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);
      setMonitoring(true);
      Alert.alert(
        'Geofence armed',
        `Monitoring a ${RADIUS_METERS} m circle. Walk ~150 m away and back; an "enter" event will be logged below and pushed as a notification.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    try {
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }
      setMonitoring(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function centerOnMe(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const fgRes = await Location.requestForegroundPermissionsAsync();
      setFg(fgRes.status === 'granted' ? 'granted' : 'denied');
      if (fgRes.status !== 'granted') {
        setError('Foreground location denied.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      Alert.alert(
        'Centre updated',
        `Geofence centre set to your current position.\n${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}\nNow tap "Start monitoring".`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="px-6 py-6 gap-4"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <View className="gap-1">
          <Text className="font-sans-bold text-2xl text-on-surface">Geofence spike</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Throwaway test for §geofence attendance. Needs a development build (not Expo Go).
          </Text>
        </View>

        <View className="gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
            Region
          </Text>
          <Text className="font-sans text-sm text-on-surface">
            {center.latitude.toFixed(6)}, {center.longitude.toFixed(6)} · r={RADIUS_METERS} m
          </Text>
          <View className="mt-2 flex-row gap-4">
            <Text className="font-sans text-xs text-on-surface-variant">
              Foreground: <Text className="text-on-surface">{fg}</Text>
            </Text>
            <Text className="font-sans text-xs text-on-surface-variant">
              Background: <Text className="text-on-surface">{bg}</Text>
            </Text>
            <Text className="font-sans text-xs text-on-surface-variant">
              Monitoring: <Text className="text-on-surface">{monitoring ? 'yes' : 'no'}</Text>
            </Text>
          </View>
        </View>

        {error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}

        <View className="gap-2">
          <Button
            disabled={busy}
            onPress={() => void centerOnMe()}
            variant="outline"
            className="h-12 border-primary"
            textClassName="text-primary"
            label="Centre on my current GPS"
          />
          <Button
            disabled={busy || monitoring}
            onPress={() => void start()}
            variant="secondary"
            className="h-12"
            label="Start monitoring"
          />
          <Button
            disabled={busy || !monitoring}
            onPress={() => void stop()}
            variant="destructive"
            className="h-12"
            label="Stop monitoring"
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-lg text-primary">Event log</Text>
          <Pressable
            onPress={() =>
              void (async () => {
                await clearLog();
                await refresh();
              })()
            }
          >
            <Text className="font-sans text-xs text-on-surface-variant">Clear</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={FIELD_ORANGE} /> : null}

        {log.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">
            No events yet. Arm the geofence, then cross the boundary.
          </Text>
        ) : (
          log.map((e, i) => (
            <View
              key={`${e.timestampIso}-${i}`}
              className="flex-row items-center justify-between rounded-lg border border-outline-variant px-4 py-2"
            >
              <Text
                className={`font-sans-semibold text-sm ${
                  e.type === 'enter'
                    ? 'text-[#16a34a]'
                    : e.type === 'exit'
                      ? 'text-primary'
                      : 'text-[#c1121f]'
                }`}
              >
                {e.type.toUpperCase()}
              </Text>
              <Text className="font-sans-medium text-[11px] text-on-surface-variant">
                {new Date(e.timestampIso).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
