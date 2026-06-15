import { MATCH_TYPE_SELECT_OPTIONS } from '@acc/types';

import { Select, type SelectProps } from './Select';

export type MatchTypeSelectProps = Omit<
  SelectProps,
  'label' | 'labelVariant' | 'placeholder' | 'options'
>;

/** Match Type field shared across Manual, Round Robin, and Group Stage setup. */
export function MatchTypeSelect({
  value,
  onChange,
  error,
  ...rest
}: MatchTypeSelectProps): React.ReactElement {
  return (
    <Select
      label="Match Type"
      labelVariant="brand"
      placeholder="Select Match Type"
      value={value}
      options={MATCH_TYPE_SELECT_OPTIONS}
      onChange={onChange}
      error={error}
      {...rest}
    />
  );
}
