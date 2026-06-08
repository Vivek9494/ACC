import { TextInput, type TextInputProps } from './ui/TextInput';

interface FormFieldProps extends TextInputProps {
  label: string;
}

/** Labeled text input — delegates to the shared TextInput wrapper. */
export function FormField({ label, ...inputProps }: FormFieldProps): React.ReactElement {
  return <TextInput label={label} {...inputProps} />;
}
