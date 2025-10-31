export const COMPANY_NAME = 'CTrax';
export const PRIVACY_LAST_UPDATED = 'October 26, 2025';
export const TERMS_EFFECTIVE_DATE = 'October 26, 2025';
export const PRINT_WATERMARK_TEXT = `${COMPANY_NAME}`;

export function getSiteOrigin() {
  try { return window.location.origin } catch { return 'ctrax.app' }
}
