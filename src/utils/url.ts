/**
 * Centralized Production & Development URL Configuration
 * 
 * Strict Architecture:
 * - Public Customer Frontend: https://cafe-system-jade.vercel.app (or VITE_APP_URL)
 * - Backend Node/Express API: https://cafe-system-c0zf.onrender.com (or VITE_API_URL)
 */

export const PRODUCTION_FRONTEND_URL = 'https://cafe-system-jade.vercel.app';
export const PRODUCTION_API_URL = 'https://cafe-system-c0zf.onrender.com';

/**
 * Get the public frontend URL (customer-facing website)
 * Never returns backend port 3000 or Render URL.
 */
export function getPublicFrontendUrl(): string {
  const configured = (import.meta.env?.VITE_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured && !configured.includes(':3000') && !configured.includes('onrender.com')) {
    return configured;
  }
  return PRODUCTION_FRONTEND_URL;
}

/**
 * Get the backend API base URL for REST and SSE requests
 */
export function getBackendApiUrl(): string {
  const configured = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  return `${PRODUCTION_API_URL}/api`;
}

/**
 * Get the realtime SSE streaming endpoint URL
 */
export function buildRealtimeStreamUrl(): string {
  return `${getBackendApiUrl()}/realtime/stream`;
}

/**
 * Centralized function to build customer QR destination URLs.
 * Every QR code and standee across the system MUST use this function.
 * 
 * Target format:
 * https://cafe-system-jade.vercel.app/?mode=customer&qr=<SECURE_TOKEN>
 */
export function buildCustomerQRUrl(qrToken: string): string {
  const base = getPublicFrontendUrl();
  return `${base}/?mode=customer&qr=${encodeURIComponent(qrToken)}`;
}
