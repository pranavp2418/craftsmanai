/**


 * @param url The original image URL
 * @param updatedAt The timestamp or date string of when the resource was updated
 */
export function getCacheBustedUrl(url: string | null | undefined, updatedAt?: string | number | null): string {
  if (!url) return '';

  const cleanUrl = url.trim();

  // Skip data URLs, blob URLs, and SVGs/placeholders
  if (
    cleanUrl.startsWith('data:') ||
    cleanUrl.startsWith('blob:') ||
    cleanUrl.includes('.svg') ||
    cleanUrl.startsWith('inline:')
  ) {
    return cleanUrl;
  }

  let version = '';
  if (updatedAt) {
    const t = typeof updatedAt === 'number' ? updatedAt : new Date(updatedAt).getTime();
    if (!isNaN(t)) {
      version = String(t);
    }
  }

  if (!version) {
    // Fallback: Use a stable page load timestamp to bypass initial cache,
    // but keep it stable across react re-renders
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (!win.__pageLoadTime) {
        win.__pageLoadTime = Date.now();
      }
      version = String(win.__pageLoadTime);
    } else {
      version = String(Date.now());
    }
  }

  const separator = cleanUrl.includes('?') ? '&' : '?';
  return `${cleanUrl}${separator}cv=${version}`;
}
