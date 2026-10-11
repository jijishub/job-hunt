// Only the owner's published portfolio is used; other accounts use their saved resumes.
export async function portfolioEvidence(email: string) {
  if (email.toLowerCase() !== 'jizelle.casia@gmail.com') return '';
  try {
    const response = await fetch('https://jizellecasia.vercel.app/api/content', { signal: AbortSignal.timeout(8000), next: { revalidate: 300 } });
    if (!response.ok) return '';
    const json = await response.json(); const data = json.data || json;
    return JSON.stringify({ about: data.about, experience: data.experience, projects: data.projects }).replace(/<[^>]*>/g, '').slice(0, 16000);
  } catch { return ''; }
}
