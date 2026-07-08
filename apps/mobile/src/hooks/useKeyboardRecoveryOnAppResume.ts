import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, type AppStateStatus } from 'react-native';

function wasBackgrounded(state: AppStateStatus): boolean {
  return state === 'background' || state === 'inactive';
}

/**
 * Dismisses the keyboard when the app leaves foreground and remounts keyboard-
 * avoiding layout when returning from background so stale insets do not squash
 * scroll content.
 */
export function useKeyboardRecoveryOnAppResume(): number {
  const [layoutKey, setLayoutKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background') {
        Keyboard.dismiss();
        return;
      }

      if (nextState === 'active' && wasBackgrounded(previousState)) {
        Keyboard.dismiss();
        if (previousState === 'background') {
          setLayoutKey((current) => current + 1);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return layoutKey;
}
