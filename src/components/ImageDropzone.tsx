'use client';

import { useState } from 'react';

export default function ImageDropzone({ onImage }: { onImage: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const accept = (files: File[]) => {
    const image = files.find(file => file.type.startsWith('image/'));
    if (image) onImage(image);
    return Boolean(image);
  };
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Paste or drop a company image"
      onPaste={event => {
        if (accept(Array.from(event.clipboardData.files))) event.preventDefault();
      }}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        accept(Array.from(event.dataTransfer.files));
      }}
      className={`my-2 rounded-xl border border-dashed p-3 text-center text-xs text-[#9D3C5E] outline-none focus:ring-2 focus:ring-[#FF7AB3] ${dragging ? 'border-[#FF7AB3] bg-[#FCE7F3]' : 'border-[#F1DDE9] bg-[#FFF5F8]'}`}
    >
      Click here and press Ctrl+V to paste an image, or drop an image here.
    </div>
  );
}
