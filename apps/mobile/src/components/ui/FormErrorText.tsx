import { ERROR_TEXT_CLASS, FIELD_ERROR_TEXT_CLASS } from './fieldStyles';
import { Text } from './Text';

export interface FormErrorTextProps {
  children?: string | null;
  /** Adds ml-1 mt-1 for inline placement under a field. */
  inline?: boolean;
  className?: string;
}

/** Shared validation / form error message — primary orange from fieldStyles tokens. */
export function FormErrorText({
  children,
  inline = false,
  className,
}: FormErrorTextProps): React.ReactElement | null {
  if (!children) {
    return null;
  }
  const base = inline ? FIELD_ERROR_TEXT_CLASS : ERROR_TEXT_CLASS;
  const merged = className ? `${base} ${className}` : base;
  return <Text className={merged}>{children}</Text>;
}
