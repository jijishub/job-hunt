'use client';
import { useState } from 'react';
import { Building2 } from 'lucide-react';

export default function CompanyLogo({ src, alt = '', className, emojiClassName = 'text-xl' }: { src?: string; alt?: string; className: string; emojiClassName?: string }) {
  const [failed,setFailed] = useState<string>();
  if (src?.startsWith('emoji:')) return <span className={emojiClassName}>{src.slice(6)}</span>;
  if (!src || failed === src) return <Building2 aria-label={alt ? `${alt} logo unavailable` : undefined} className={`${className} text-stone-300`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(src)} />;
}
