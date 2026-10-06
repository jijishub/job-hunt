import React from 'react';
import { Priority } from '@/types/job';
import { Sparkles, Star } from 'lucide-react';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  DREAM: {
    label: 'Dream Job',
    bg: 'bg-rose-50',
    text: 'text-[#9D3C5E]',
    border: 'border-[#F1DDE9]',
    icon: <Sparkles className="w-3 h-3 text-[#FF7AB3]" />,
  },
  HIGH: {
    label: 'High',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: <Star className="w-3 h-3 fill-amber-400 text-amber-400" />,
  },
  MEDIUM: {
    label: 'Medium',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    icon: null,
  },
  LOW: {
    label: 'Low',
    bg: 'bg-stone-50',
    text: 'text-stone-600',
    border: 'border-stone-200',
    icon: null,
  },
};

export default function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${config.bg} ${config.text} ${config.border} ${padding}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

