// Detailed ATS reports need more time than short fit assessments. Keep the
// browser budget outside the route's 180 seconds and its provider deadline.
export const DEFAULT_AI_TIMEOUT_MS = 25_000;
export const ATS_AI_TIMEOUT_MS = 150_000;
export const ATS_BROWSER_TIMEOUT_MS = 185_000;
export const ATS_MAX_OUTPUT_TOKENS = 3_500;
