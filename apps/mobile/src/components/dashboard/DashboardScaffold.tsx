import type { ReactNode } from 'react';
import { Fragment } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar, type BottomTabItem } from '../ui/BottomTabBar';
import { DashboardHeader } from '../ui/DashboardHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

export interface DashboardTabConfig {
  tabs: BottomTabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
}

export interface DashboardScaffoldProps {
  /** Shown when the user record is not yet loaded. */
  headerFallbackName?: string;
  /** When set, replaces the default {@link DashboardHeader}. */
  header?: ReactNode;
  /** Ordered section blocks supplied by the role dashboard. */
  sections: ReactNode[];
  /** Optional footer pinned below the main body (e.g. player action buttons). */
  footer?: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** When set, renders the shared bottom tab bar below the body. */
  tabConfig?: DashboardTabConfig;
  /**
   * `scroll` — standard dashboard ScrollView (Admin / Manager / Captain).
   * `split` — flex column with optional footer pinned at the bottom (player home).
   */
  layout?: 'scroll' | 'split';
}

function DashboardBodyContent({
  isLoading,
  error,
  onRetry,
  sections,
}: Pick<DashboardScaffoldProps, 'isLoading' | 'error' | 'onRetry' | 'sections'>): React.ReactElement {
  if (isLoading) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-xl bg-error-container px-4 py-3">
        <Text className="font-sans text-sm text-on-error-container">{error}</Text>
        {onRetry ? (
          <Pressable
            onPress={() => {
              onRetry();
            }}
            className="mt-2"
          >
            <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {sections.map((section, index) => (
        <Fragment key={index}>{section}</Fragment>
      ))}
    </>
  );
}

/**
 * Shared dashboard shell: header, scrollable (or split) body, loading/error states,
 * optional pull-to-refresh, and optional bottom tab bar.
 */
export function DashboardScaffold({
  headerFallbackName = 'User',
  header,
  sections,
  footer,
  isLoading = false,
  error = null,
  onRetry,
  refreshing = false,
  onRefresh,
  tabConfig,
  layout = 'scroll',
}: DashboardScaffoldProps): React.ReactElement {
  const showSections = !isLoading && !error;
  const bodyContent = (
    <DashboardBodyContent
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      sections={showSections ? sections : []}
    />
  );

  const refreshControl =
    onRefresh !== undefined ? (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    ) : undefined;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1">
        {layout === 'split' ? (
          <View className="flex-1 justify-between px-4 py-4">
            <View className="gap-6">
              {header ?? <DashboardHeader fallbackName={headerFallbackName} />}
              {bodyContent}
            </View>
            {footer ?? null}
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="gap-6 px-4 pb-8 pt-4"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {header ?? <DashboardHeader fallbackName={headerFallbackName} />}
            {bodyContent}
          </ScrollView>
        )}
      </View>
      {tabConfig ? (
        <BottomTabBar
          tabs={tabConfig.tabs}
          activeKey={tabConfig.activeKey}
          onTabPress={tabConfig.onTabPress}
        />
      ) : null}
    </SafeAreaView>
  );
}
