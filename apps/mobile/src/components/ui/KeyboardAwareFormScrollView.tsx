import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';

import { useKeyboardRecoveryOnAppResume } from '../../hooks/useKeyboardRecoveryOnAppResume';

const DEFAULT_EXTRA_BOTTOM_PADDING = 24;
/** Gap between the focused field bottom and the keyboard top. */
const KEYBOARD_TOP_MARGIN = 20;
/** Gap between the focused field top and the scroll viewport top (below header). */
const VIEWPORT_TOP_MARGIN = 8;
/** Ignore sub-pixel scroll adjustments. */
const SCROLL_EPSILON = 2;
const KEYBOARD_SCROLL_DELAY_MS = Platform.OS === 'ios' ? 150 : 250;

type KeyboardAwareFormScrollContextValue = {
  scrollFieldIntoView: (field: View | null) => void;
};

const KeyboardAwareFormScrollContext =
  createContext<KeyboardAwareFormScrollContextValue | null>(null);

export function useKeyboardAwareFormScroll(): KeyboardAwareFormScrollContextValue | null {
  return useContext(KeyboardAwareFormScrollContext);
}

export interface KeyboardAwareFormContainerProps {
  children: ReactNode;
  className?: string;
  keyboardVerticalOffset?: number;
}

/**
 * Keyboard-avoiding flex wrapper for screens that use FlatList or custom layouts
 * instead of a form ScrollView (e.g. search + list).
 */
export function KeyboardAwareFormContainer({
  children,
  className = 'flex-1',
  keyboardVerticalOffset = 0,
}: KeyboardAwareFormContainerProps): React.ReactElement {
  const keyboardLayoutKey = useKeyboardRecoveryOnAppResume();

  return (
    <KeyboardAvoidingView
      key={keyboardLayoutKey}
      className={className}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export interface KeyboardAwareFormScrollViewProps extends ScrollViewProps {
  children: ReactNode;
  /** Fixed footer rendered inside the avoiding view but outside the scroll area. */
  footer?: ReactNode;
  /** Space below the last field when the keyboard is closed. */
  extraBottomPadding?: number;
  /** Tune when a fixed header sits above the scroll area. */
  keyboardVerticalOffset?: number;
  /** Use inside modals/sheets where flex-1 layout is not desired. */
  compact?: boolean;
}

/**
 * Scroll container for long forms: shrinks with the keyboard, adds bottom inset
 * equal to keyboard height, and scrolls focused fields into view via context.
 */
export const KeyboardAwareFormScrollView = forwardRef<
  ScrollView,
  KeyboardAwareFormScrollViewProps
>(function KeyboardAwareFormScrollView(
  {
    children,
    footer,
    extraBottomPadding = DEFAULT_EXTRA_BOTTOM_PADDING,
    keyboardVerticalOffset = 0,
    compact = false,
    contentContainerClassName,
    contentContainerStyle,
    onScroll,
    ...scrollProps
  },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const lastFocusedFieldRef = useRef<View | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardLayoutKey = useKeyboardRecoveryOnAppResume();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const setScrollRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      lastFocusedFieldRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const performScrollIntoView = useCallback((field: View | null): void => {
    if (!field || !scrollRef.current || !viewportRef.current) {
      return;
    }

    field.measureInWindow((_fx, fieldTop, _fw, fieldHeight) => {
      viewportRef.current?.measureInWindow((_vx, viewportTop, _vw, viewportHeight) => {
        const fieldBottom = fieldTop + fieldHeight;
        const visibleTop = viewportTop + VIEWPORT_TOP_MARGIN;
        const visibleBottom =
          viewportTop + viewportHeight - KEYBOARD_TOP_MARGIN;

        if (fieldTop >= visibleTop && fieldBottom <= visibleBottom) {
          return;
        }

        let delta = 0;

        if (fieldBottom > visibleBottom) {
          delta = fieldBottom - visibleBottom;
        }

        // Cap so the field (and label) is not pushed above the viewport top.
        if (fieldTop - delta < visibleTop) {
          delta = Math.max(0, fieldTop - visibleTop);
        }

        if (delta <= SCROLL_EPSILON) {
          return;
        }

        scrollRef.current?.scrollTo({
          y: scrollYRef.current + delta,
          animated: true,
        });
      });
    });
  }, []);

  const scheduleScrollIntoView = useCallback(
    (field: View | null): void => {
      if (!field) {
        return;
      }

      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        performScrollIntoView(field);
      }, KEYBOARD_SCROLL_DELAY_MS);
    },
    [performScrollIntoView],
  );

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const scrollFieldIntoView = useCallback(
    (field: View | null): void => {
      if (!field) {
        return;
      }

      lastFocusedFieldRef.current = field;

      // Wait for keyboard layout; re-scroll runs when keyboardHeight updates.
      if (keyboardHeight > 0) {
        scheduleScrollIntoView(field);
      }
    },
    [keyboardHeight, scheduleScrollIntoView],
  );

  useEffect(() => {
    if (keyboardHeight > 0 && lastFocusedFieldRef.current) {
      scheduleScrollIntoView(lastFocusedFieldRef.current);
    }
    return undefined;
  }, [keyboardHeight, scheduleScrollIntoView]);

  const contextValue = useMemo(
    () => ({ scrollFieldIntoView }),
    [scrollFieldIntoView],
  );

  const bottomInset =
    keyboardHeight > 0 ? keyboardHeight + extraBottomPadding : extraBottomPadding;

  const scrollBody = (
    <View ref={viewportRef} collapsable={false} className={compact ? undefined : 'flex-1'}>
      <ScrollView
        ref={setScrollRef}
        className={compact ? undefined : 'flex-1'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName={contentContainerClassName}
        contentContainerStyle={[{ paddingBottom: bottomInset }, contentContainerStyle]}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        scrollEventThrottle={16}
        {...scrollProps}
      >
        <View collapsable={false}>{children}</View>
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView
      key={keyboardLayoutKey}
      className={compact ? undefined : 'flex-1'}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <KeyboardAwareFormScrollContext.Provider value={contextValue}>
        {footer ? (
          <View className={compact ? undefined : 'flex-1'}>
            {scrollBody}
            {footer}
          </View>
        ) : (
          scrollBody
        )}
      </KeyboardAwareFormScrollContext.Provider>
    </KeyboardAvoidingView>
  );
});
