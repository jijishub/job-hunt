'use client';

import ImageDropzone from './ImageDropzone';

import React, { useState, useEffect } from 'react';
import { Company } from '@/types/job';
import { X, Building2, Globe, Image as ImageIcon, Upload } from 'lucide-react';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Partial<Company>) => Promise<void>;
  initialData?: Company | null;
}

const PRESET_ICONS = ['🌸', '💼', '🚀', '🦄', '💻', '🏢', '✨', '🎯', '🎨', '💖'];

function compressImage(file: File, callback: (base64: string) => void) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 128;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress to WebP (<20KB)
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        callback(dataUrl);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export default function CompanyModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: CompanyModalProps) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setWebsite(initialData.website || '');
      setLogoUrl(initialData.logo_url || '');
      setIndustry(initialData.industry || '');
      setSelectedEmoji(null);
    } else {
      setName('');
      setWebsite('');
      setLogoUrl('');
      setIndustry('');
      setSelectedEmoji(null);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleWebsiteBlur = () => {
    if (website && !logoUrl && !selectedEmoji) {
      try {
        const cleanDomain = website.replace(/^https?:\/\//, '').split('/')[0];
        setLogoUrl(`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`);
      } catch (e) {
        // ignore
      }
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);
    setLogoUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const finalLogo = selectedEmoji ? `emoji:${selectedEmoji}` : logoUrl;
      await onSave({
        name: name.trim(),
        website: website.trim() || undefined,
        logo_url: finalLogo || undefined,
        industry: industry.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#F1DDE9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1DDE9] bg-gradient-to-r from-[#FFF5F8] to-[#FFF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FCE7F3] flex items-center justify-center text-[#9D3C5E]">
              <Building2 className="w-4 h-4 text-[#FF7AB3]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#4A3E44]">
                {initialData ? 'Edit Company' : 'Add New Company'}
              </h2>
              <p className="text-xs text-[#736A6D]">Reusable profile with icon for your applications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
              Company Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Notion, OpenAI, Figma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-sm text-[#4A3E44] placeholder-stone-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
              Website
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={handleWebsiteBlur}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-sm text-[#4A3E44] placeholder-stone-400 transition"
              />
              <Globe className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-[#736A6D] mt-1">
              Tip: Leaving company website auto-fetches the company logo icon!
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
              Company Icon / Logo
            </label>

            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
              {PRESET_ICONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border transition ${
                    selectedEmoji === emoji
                      ? 'border-[#FF7AB3] bg-[#FCE7F3] scale-110 shadow-xs'
                      : 'border-[#F1DDE9] hover:bg-[#FAF7F9]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F1DDE9] bg-white hover:bg-[#FFF0F6] text-xs font-semibold text-[#9D3C5E] transition shadow-xs hover:border-[#FF7AB3]">
                <Upload className="w-3.5 h-3.5 text-[#FF7AB3]" />
                <span>Upload Logo / Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressImage(file, (dataUrl) => {
                        setLogoUrl(dataUrl);
                        setSelectedEmoji(null);
                      });
                    }
                  }}
                />
              </label>
              <span className="text-[11px] text-[#736A6D]">Auto-compressed (&lt;20KB)</span>
            </div>

            <ImageDropzone onImage={file => compressImage(file, dataUrl => { setLogoUrl(dataUrl); setSelectedEmoji(null); })} />

            <div className="relative">
              <input
                type="url"
                placeholder="Or paste an image URL (PNG, SVG, JPG)"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setSelectedEmoji(null);
                }}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-sm text-[#4A3E44] placeholder-stone-400 transition"
              />
              <ImageIcon className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#F1DDE9] flex items-center justify-center overflow-hidden shadow-xs shrink-0">
              {selectedEmoji ? (
                <span className="text-xl">{selectedEmoji}</span>
              ) : logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Preview"
                  className="w-6 h-6 object-contain"
                  onError={() => setLogoUrl('')}
                />
              ) : (
                <Building2 className="w-5 h-5 text-stone-300" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#4A3E44]">
                {name.trim() || 'Company Preview'}
              </p>
              <p className="text-[11px] text-[#736A6D]">
                {website ? website.replace(/^https?:\/\//, '') : 'No website linked'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
              Industry (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Design, FinTech, Developer Tools"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-sm text-[#4A3E44] placeholder-stone-400 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#736A6D] hover:bg-stone-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

