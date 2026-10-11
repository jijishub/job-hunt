'use client';
import { X } from 'lucide-react';
export default function CloseButton({ onClick, label = 'Close', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#736A6D] hover:bg-[#FFF0F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7AB3] transition ${className}`}><X className="h-4 w-4" aria-hidden="true" /></button>;
}
