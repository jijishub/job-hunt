import React from 'react';
import { ApplicationStatus } from '@/types/job';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'md';
}

export const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  LEAD: {
    label: 'Lead / Wishlist',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-400',
  },
  APPLIED: {
    label: 'Applied',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-400',
  },
  SCREENING: {
    label: 'Screening',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
  },
  INTERVIEWING: {
    label: 'Interviewing',
    bg: 'bg-pink-50',
    text: 'text-[#9D3C5E]',
    border: 'border-[#F1DDE9]',
    dot: 'bg-[#FF7AB3]',
  },
  OFFER: {
    label: 'Offer Received',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-400',
  },
  ACCEPTED: {
    label: 'Accepted 🎉',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-stone-50',
    text: 'text-stone-600',
    border: 'border-stone-200',
    dot: 'bg-stone-400',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    bg: 'bg-stone-50',
    text: 'text-stone-500',
    border: 'border-stone-200',
    dot: 'bg-stone-400',
  },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.LEAD;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${padding} transition-all`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

