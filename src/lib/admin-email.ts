// Normalize the legacy seed typo so old deployment configuration cannot recreate it.
export function getAdminEmail() {
  const configured = (process.env.ADMIN_EMAIL || 'jizelle.casia@gmail.com').toLowerCase().trim();
  return configured === 'jizellecasia@gmail.com' ? 'jizelle.casia@gmail.com' : configured;
}
