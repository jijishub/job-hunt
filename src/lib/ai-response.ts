// Browser response handling for optional insights and discovery requests.
export async function readAIResponse<T extends { success: boolean; error?: string }>(response: Response, fallback: string): Promise<T> {
  const data: T | null = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || ([502, 504].includes(response.status)
      ? 'The AI service did not finish in time. Try again later. Your last result is still available.'
      : fallback));
  }
  return data;
}
