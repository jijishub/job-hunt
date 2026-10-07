import React from 'react';
import { getStatusStyle } from '@/lib/statuses';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = getStatusStyle(status || 'Applied');
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${padding} transition-all font-medium whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{status || 'Applied'}</span>
    </span>
  );
}
