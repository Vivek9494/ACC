import type { MutableRefObject } from 'react';

/** Begin an explicit icon-tap navigation to a participant picker screen. */
export function beginExplicitPickerNavigation(
  pending: MutableRefObject<boolean>,
  suppressKey: MutableRefObject<string | number | null>,
  skipNextFocusLoad: MutableRefObject<boolean>,
): void {
  suppressKey.current = null;
  pending.current = true;
  skipNextFocusLoad.current = true;
}

/** User returned from a picker without making a selection — suppress auto re-prompt. */
export function handlePickerDismissWithoutSelection(
  pending: MutableRefObject<boolean>,
  suppressKey: MutableRefObject<string | number | null>,
  suppressValue: string | number | null,
): void {
  pending.current = false;
  if (suppressValue != null) {
    suppressKey.current = suppressValue;
  }
}

export function clearPickerNavigationGuard(
  pending: MutableRefObject<boolean>,
  suppressKey: MutableRefObject<string | number | null>,
): void {
  pending.current = false;
  suppressKey.current = null;
}

export function isPickerAutoPromptSuppressed(
  suppressKey: MutableRefObject<string | number | null>,
  value: string | number | null,
): boolean {
  return value != null && suppressKey.current === value;
}
