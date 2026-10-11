'use client';

import { useState, type InputHTMLAttributes } from 'react';

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string | number | undefined;
  onValueChange: (value: string) => void;
};

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function CurrencyInput({ value, onValueChange, onFocus, onBlur, ...props }: CurrencyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = value === undefined || value === '' ? '' : moneyFormat.format(Number(value));

  return <input
    {...props}
    type="text"
    inputMode="decimal"
    value={draft ?? displayValue}
    onFocus={event => { setDraft(displayValue); onFocus?.(event); }}
    onBlur={event => { setDraft(null); onBlur?.(event); }}
    onChange={event => {
      const input = event.currentTarget;
      const raw = input.value.replace(/,/g, '');
      if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;

      const position = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/,/g, '').length;
      const [whole, fraction] = raw.split('.');
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = grouped + (fraction === undefined ? '' : `.${fraction}`);
      setDraft(formatted);
      onValueChange(raw === '.' ? '' : raw);

      // Keep the caret beside the same digit when thousands separators appear.
      let caret = 0;
      let characters = 0;
      while (caret < formatted.length && characters < position) {
        if (formatted[caret] !== ',') characters++;
        caret++;
      }
      requestAnimationFrame(() => {
        if (document.activeElement === input) input.setSelectionRange(caret, caret);
      });
    }}
  />;
}
