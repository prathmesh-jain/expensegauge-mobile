import { useEffect, useRef } from 'react';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export type { DateTimePickerEvent };

type Props = {
  value: Date;
  mode?: 'date' | 'time';
  maximumDate?: Date;
  minimumDate?: Date;
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  // Native-only props the screens pass; ignored here
  [key: string]: unknown;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const event = (type: 'set' | 'dismissed', date?: Date) =>
  ({ type, nativeEvent: { timestamp: date?.getTime() ?? Date.now(), utcOffset: 0 } }) as DateTimePickerEvent;

/**
 * Browser version of the date/time picker. Like the Android picker, the screens
 * mount it when the user taps a date and unmount it from onChange; here it opens
 * the browser's own picker straight away and reports the pick, or a dismissal.
 */
export default function DateTimePicker({ value, mode = 'date', maximumDate, minimumDate, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const finish = (type: 'set' | 'dismissed', date?: Date) => {
      if (done.current) return;
      done.current = true;
      onChangeRef.current?.(event(type, date), date);
    };
    const handleChange = () => {
      if (!input.value) return;
      const picked = new Date(value);
      if (mode === 'time') {
        const [h, m] = input.value.split(':').map(Number);
        picked.setHours(h, m, 0, 0);
      } else {
        const [y, mo, d] = input.value.split('-').map(Number);
        picked.setFullYear(y, mo - 1, d);
      }
      finish('set', picked);
    };
    const handleCancel = () => finish('dismissed');

    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel);
    input.addEventListener('blur', handleCancel);
    try {
      input.focus();
      input.showPicker();
    } catch {
      // showPicker is unsupported or blocked: leave the field visible to use directly
      input.style.opacity = '1';
      input.style.pointerEvents = 'auto';
    }
    return () => {
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel);
      input.removeEventListener('blur', handleCancel);
    };
    // Opens once per mount, the way the native picker does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const format = mode === 'time' ? toTimeValue : toDateValue;
  return (
    <input
      ref={inputRef}
      type={mode === 'time' ? 'time' : 'date'}
      defaultValue={format(value)}
      max={maximumDate && mode === 'date' ? toDateValue(maximumDate) : undefined}
      min={minimumDate && mode === 'date' ? toDateValue(minimumDate) : undefined}
      style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none', border: 0 }}
    />
  );
}
