// Shared by database-backed analytics, PDF exports, and chart drilldowns.
// These are language/seniority rules, not job categories or industry aliases.
export const KEYWORD_CHART_LIMIT = 6;
export const KEYWORD_MIN_APPLICATIONS = 5;
const OMIT = new Set('a an and or the of for in on at to with from by as is are be been being this that these those our your their very can could should must will would job jobs role position hiring urgent wanted vacancy required full time part contract remote hybrid onsite senior sr junior jr graduate intern internship trainee apprentice intermediate lead principal level ii iii iv'.split(' '));
const CONNECTORS = new Set(['and', 'of', 'for', 'in', 'with', '&']);

export function jobTitleKeywords(title = '') {
  const normalized = title.normalize('NFKC')
    .replace(/\b(?:entry[\s-]+level|mid[\s-]+level|fresh[\s-]+grad(?:uate)?|new[\s-]+grad(?:uate)?|on[\s-]+site)\b/gi, ' ');
  const keywords = new Map<string, { key: string; label: string }>();
  // Separators end a phrase; hyphens between words behave like spaces.
  for (const segment of normalized.split(/[\/|(),;:–—]/u)) {
    const tokens = [...segment.matchAll(/\.?[\p{L}\p{N}]+(?:[.&][\p{L}\p{N}]+)*[+#]*|&/gu)].map(match => ({
      key: match[0].toLowerCase(),
      label: match[0].length <= 2 || (match[0].length <= 6 && match[0] === match[0].toUpperCase()) || /[.+#&]/u.test(match[0])
        ? match[0].toUpperCase() : match[0][0].toUpperCase() + match[0].slice(1).toLowerCase(),
    }));
    const meaningful = (key: string) => !OMIT.has(key) && !/^\p{N}+$/u.test(key) && (key.length > 1 || /[+#]/u.test(key));
    for (let start = 0; start < tokens.length; start++) {
      if (!meaningful(tokens[start].key)) continue;
      for (let size = 1; size <= 3 && start + size <= tokens.length; size++) {
        const phrase = tokens.slice(start, start + size);
        if (!meaningful(phrase[phrase.length - 1].key) || phrase.some(token => !meaningful(token.key) && !CONNECTORS.has(token.key))) continue;
        const key = phrase.map(token => token.key).join(' ');
        const label = phrase.map(token => CONNECTORS.has(token.key) ? token.key : token.label).join(' ');
        // A repeated term or phrase counts once per application, regardless of case.
        const previous = keywords.get(key);
        if (!previous || label < previous.label) keywords.set(key, { key, label });
      }
    }
  }
  return [...keywords.values()];
}
