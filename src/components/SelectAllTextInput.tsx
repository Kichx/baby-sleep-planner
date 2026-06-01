import { useEffect, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

interface TextSelection {
  start: number;
  end: number;
}

interface SelectAllTextInputProps
  extends Omit<TextInputProps, 'onChangeText' | 'selectTextOnFocus' | 'selection' | 'value'> {
  normalizeText?: (value: string) => string;
  onChangeText: (value: string) => void;
  value: string;
}

export function SelectAllTextInput({
  editable,
  normalizeText,
  onBlur,
  onChangeText,
  onFocus,
  value,
  ...textInputProps
}: SelectAllTextInputProps) {
  const [selection, setSelection] = useState<TextSelection | undefined>(undefined);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldCollapseSelectionRef = useRef(false);

  function clearReleaseTimer() {
    if (releaseTimerRef.current !== null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }

  function releaseSelectionSoon() {
    clearReleaseTimer();
    releaseTimerRef.current = setTimeout(() => {
      setSelection(undefined);
      releaseTimerRef.current = null;
    }, 50);
  }

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current !== null) {
        clearTimeout(releaseTimerRef.current);
      }
    };
  }, []);

  return (
    <TextInput
      {...textInputProps}
      editable={editable}
      onBlur={(event) => {
        clearReleaseTimer();
        shouldCollapseSelectionRef.current = false;
        setSelection(undefined);
        onBlur?.(event);
      }}
      onChangeText={(nextValue) => {
        const normalizedValue = normalizeText ? normalizeText(nextValue) : nextValue;

        onChangeText(normalizedValue);

        if (shouldCollapseSelectionRef.current) {
          shouldCollapseSelectionRef.current = false;
          setSelection({ start: normalizedValue.length, end: normalizedValue.length });
          releaseSelectionSoon();
        }
      }}
      onFocus={(event) => {
        onFocus?.(event);

        if (editable !== false) {
          clearReleaseTimer();
          shouldCollapseSelectionRef.current = true;
          setSelection({ start: 0, end: value.length });
        }
      }}
      selectTextOnFocus={false}
      selection={selection}
      value={value}
    />
  );
}
