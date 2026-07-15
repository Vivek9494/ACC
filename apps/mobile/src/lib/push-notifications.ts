/**
 * Global push presentation (§17). Without a handler, expo-notifications
 * suppresses banners while the app is foregrounded — so the user who posts a
 * broadcast (and anyone else with the app open) would never see the system
 * notification even though FCM delivered it.
 *
 * Import this module once at app startup (root layout). Audience resolution is
 * unchanged; this only controls on-device presentation.
 */
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
