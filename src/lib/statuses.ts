import { ApplicationStatus } from '@/types/job';

export interface StatusOption {
  id: string;
  name: string;
  color: 'green' | 'purple' | 'gray' | 'orange' | 'brown' | 'blue' | 'yellow' | 'red' | 'default';
  category: ApplicationStatus;
  isCustom?: boolean;
}

// Exactly 15 seeded statuses matching Notion database
export const SEEDED_STATUS_OPTIONS: StatusOption[] = [
  { id: 'accepted', name: 'Accepted', color: 'green', category: 'ACCEPTED' },
  { id: 'accepted_not_proceeding', name: 'Accepted - Not Proceeding', color: 'purple', category: 'OFFER' },
  { id: 'not_started', name: 'Not started', color: 'gray', category: 'LEAD' },
  { id: 'initial_interview', name: 'Initial Interview', color: 'orange', category: 'INTERVIEWING' },
  { id: 'technical_interview', name: 'Technical Interview', color: 'brown', category: 'INTERVIEWING' },
  { id: 'interview_task', name: 'Interview Task', color: 'purple', category: 'INTERVIEWING' },
  { id: 'final_interview', name: 'Final Interview', color: 'blue', category: 'INTERVIEWING' },
  { id: 'inquiry', name: 'Inquiry', color: 'blue', category: 'LEAD' },
  { id: 'applied_with_moa', name: 'Applied - With MOA', color: 'yellow', category: 'APPLIED' },
  { id: 'applied_no_moa', name: 'Applied - No MOA', color: 'purple', category: 'APPLIED' },
  { id: 'not_accepting_interns', name: 'Not Accepting Interns', color: 'red', category: 'REJECTED' },
  { id: 'do_not_proceed', name: 'Do not Proceed', color: 'red', category: 'WITHDRAWN' },
  { id: 'interview_not_accepted', name: 'Interview - Not Accepted', color: 'gray', category: 'REJECTED' },
  { id: 'not_accepted', name: 'Not Accepted', color: 'gray', category: 'REJECTED' },
  { id: 'repeated', name: 'Repeated', color: 'gray', category: 'REJECTED' },
];

export function getStatusCategory(statusName: string): ApplicationStatus {
  const lower = statusName.toLowerCase().trim();

  // Exact matches
  const match = SEEDED_STATUS_OPTIONS.find((s) => s.name.toLowerCase() === lower);
  if (match) return match.category;

  // Heuristic categorization for custom user statuses
  if (lower.includes('accept') && !lower.includes('not accept')) return 'ACCEPTED';
  if (lower.includes('offer')) return 'OFFER';
  if (lower.includes('interview') && !lower.includes('not accept')) return 'INTERVIEWING';
  if (lower.includes('task') || lower.includes('exam') || lower.includes('screen') || lower.includes('test')) return 'INTERVIEWING';
  if (lower.includes('applied') || lower.includes('submitted')) return 'APPLIED';
  if (lower.includes('lead') || lower.includes('inquiry') || lower.includes('not started') || lower.includes('wishlist')) return 'LEAD';
  if (lower.includes('not accepted') || lower.includes('reject') || lower.includes('repeated')) return 'REJECTED';
  if (lower.includes('withdraw') || lower.includes('do not proceed') || lower.includes('drop')) return 'WITHDRAWN';

  return 'APPLIED';
}

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  dotColor: string;
}

export function getStatusStyle(statusName: string): StatusStyle {
  const lower = statusName.toLowerCase().trim();

  if (lower === 'accepted' || lower === 'accepted 🎉') {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      dotColor: '#10b981',
    };
  }

  if (lower === 'accepted - not proceeding') {
    return {
      bg: 'bg-fuchsia-50',
      text: 'text-fuchsia-800',
      border: 'border-fuchsia-200',
      dot: 'bg-fuchsia-500',
      dotColor: '#d946ef',
    };
  }

  if (lower === 'initial interview') {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      dotColor: '#f59e0b',
    };
  }

  if (lower === 'technical interview') {
    return {
      bg: 'bg-amber-100/60',
      text: 'text-amber-900',
      border: 'border-amber-300',
      dot: 'bg-amber-700',
      dotColor: '#b45309',
    };
  }

  if (lower === 'interview task') {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-800',
      border: 'border-purple-200',
      dot: 'bg-purple-500',
      dotColor: '#a855f7',
    };
  }

  if (lower === 'final interview') {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      dotColor: '#3b82f6',
    };
  }

  if (lower === 'inquiry') {
    return {
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      dotColor: '#0ea5e9',
    };
  }

  if (lower === 'applied - with moa') {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      dot: 'bg-yellow-500',
      dotColor: '#eab308',
    };
  }

  if (lower === 'applied - no moa' || lower === 'applied') {
    return {
      bg: 'bg-indigo-50',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      dot: 'bg-indigo-500',
      dotColor: '#6366f1',
    };
  }

  if (lower === 'not accepting interns' || lower === 'do not proceed') {
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      dotColor: '#f43f5e',
    };
  }

  if (
    lower === 'not started' ||
    lower === 'interview - not accepted' ||
    lower === 'not accepted' ||
    lower === 'repeated' ||
    lower === 'rejected' ||
    lower === 'withdrawn'
  ) {
    return {
      bg: 'bg-stone-50',
      text: 'text-stone-700',
      border: 'border-stone-200',
      dot: 'bg-stone-400',
      dotColor: '#a8a29e',
    };
  }

  // Fallback for custom statuses
  return {
    bg: 'bg-[#FFF0F6]',
    text: 'text-[#9D3C5E]',
    border: 'border-[#F1DDE9]',
    dot: 'bg-[#FF7AB3]',
    dotColor: '#ff7ab3',
  };
}
