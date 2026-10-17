/** Capture v1 composition. Keep original text intact; deduplicate only against
 * complete whitespace-normalized paragraphs/list items in the description.
 * These rules and their golden fixtures also apply to the extension serializer.
 */
export function composeCaptureRequirements(posting: { description?: string | null; qualifications?: string[] | null }): string {
  const description = posting.description || '';
  const whitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
  const existing = new Set<string>();
  let block = '';
  const flush = () => {
    if (block.trim()) existing.add(whitespace(block));
    block = '';
  };
  for (const line of description.split('\n')) {
    const item = line.replace(/\r$/, '').match(/^\s*(?:[-*\u2022]|\d+[.)])\s+(.+)$/);
    if (!line.trim()) flush();
    else if (item) { flush(); block = item[1]; }
    else block += (block ? '\n' : '') + line;
  }
  flush();
  const remaining = (posting.qualifications || []).filter(value => whitespace(value) && !existing.has(whitespace(value)));
  return [description, remaining.length ? `Qualifications:\n${remaining.map(value => `- ${value}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
}
