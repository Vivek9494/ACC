import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_IMAGE_UPLOAD_MAX_MB } from '@acc/types';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { pickImage, profilePhotoPickOptions, type PickedImageFile } from '../../lib/imagePicker';
import { getUploadLimits } from '../../lib/upload-limits';
import {
  ERROR_BORDER_CLASS,
  FIELD_ORANGE,
  INPUT_SHADOW_STYLE,
  labelClassName,
  type LabelVariant,
} from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import { Text } from './Text';

export interface ProfilePhotoFieldProps {
  label?: string;
  labelVariant?: LabelVariant;
  uri: string | null;
  onChange: (file: PickedImageFile | null) => void;
  onValidationError?: (message: string | null) => void;
  error?: string;
  containerClassName?: string;
}

/** Optional profile photo picker (spec §3.1). Local file until upload on submit. */
export function ProfilePhotoField({
  label = 'Profile Photo',
  labelVariant = 'brand',
  uri,
  onChange,
  onValidationError,
  error,
  containerClassName,
}: ProfilePhotoFieldProps): React.ReactElement {
  const [maxMb, setMaxMb] = useState(DEFAULT_IMAGE_UPLOAD_MAX_MB);

  useEffect(() => {
    void getUploadLimits().then((limits) => {
      setMaxMb(limits.imageUploadMaxMb);
    });
  }, []);

  async function pick(): Promise<void> {
    const limits = await getUploadLimits();
    const result = await pickImage(profilePhotoPickOptions(limits));
    if (result === null) {
      return;
    }
    if (!result.ok) {
      onValidationError?.(result.error);
      return;
    }
    onValidationError?.(null);
    onChange(result.file);
  }

  const borderClass = error ? `border ${ERROR_BORDER_CLASS}` : 'border border-border';

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        onPress={() => void pick()}
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Change profile photo' : 'Add profile photo'}
        className={`w-full flex-row items-center gap-4 rounded-control bg-surface px-5 py-4 ${borderClass}`}
        style={INPUT_SHADOW_STYLE}
      >
        {uri ? (
          <Image
            source={{ uri }}
            className="h-14 w-14 rounded-xl"
            pointerEvents="none"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            className="h-14 w-14 items-center justify-center rounded-xl bg-primary-50"
            pointerEvents="none"
          >
            <Ionicons name="camera-outline" size={24} color={FIELD_ORANGE} />
          </View>
        )}
        <View className="flex-1" pointerEvents="none">
          <Text className="font-sans-semibold text-sm text-text">
            {uri ? 'Change photo' : 'Add profile photo'}
          </Text>
          <Text className="font-sans text-xs text-text-muted">
            Optional · JPG only · max {maxMb}MB
          </Text>
        </View>
        {uri ? (
          <Pressable
            onPress={() => {
              onChange(null);
              onValidationError?.(null);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove profile photo"
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      <FormErrorText inline>{error}</FormErrorText>
    </View>
  );
}
