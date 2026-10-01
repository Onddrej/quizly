/**
 * Returns a new unique id. crypto.randomUUID only exists in secure contexts (not on a plain-http
 * dev server opened from a phone, for example) and in Safari 15.4 or later; when it is missing
 * this falls back to a timestamp plus a random suffix.
 */
export function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
