// Find page cuts in CSS pixels, keeping text lines and ordinary cards intact.
export function getReportPageCuts(element: HTMLElement, pageHeight: number): number[] {
  const origin = element.getBoundingClientRect().top;
  const lines: { top: number; bottom: number }[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    for (const rect of Array.from(range.getClientRects())) {
      lines.push({ top: rect.top - origin - 2, bottom: rect.bottom - origin + 2 });
    }
  }
  const blocks = Array.from(element.querySelectorAll('li, h1, .rounded-xl, .rounded-2xl'))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top - origin, bottom: rect.bottom - origin };
    });
  const cuts = [0];
  const height = element.scrollHeight;
  while (cuts[cuts.length - 1] + pageHeight < height) {
    const start = cuts[cuts.length - 1];
    let cut = start + pageHeight;
    // Prefer keeping a complete card together when it fits on a fresh page.
    for (const block of blocks) {
      if (block.top > start + pageHeight * 0.55 && block.top < cut && block.bottom > cut
        && block.bottom - block.top < pageHeight) cut = block.top;
    }
    let overlap;
    while ((overlap = lines.find((line) => line.top < cut && line.bottom > cut))) {
      if (overlap.top <= start) break;
      cut = overlap.top;
    }
    // Very tall single lines still need forward progress.
    cuts.push(cut > start ? cut : start + pageHeight);
  }
  cuts.push(height);
  return cuts;
}
