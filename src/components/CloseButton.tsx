'use client';
import { X } from 'lucide-react';
export default function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="rounded-lg p-2 text-[#736A6D] hover:bg-[#FFF0F6] transition"><X className="h-4 w-4" /></button>;
}
