/**
 * Placeholder image URL generation.
 *
 * The mock data layer uses a placeholder provider for demo images. When
 * the provider needs to change, update the implementations below so
 * consumers don't need to be touched.
 *
 * The pattern is intentionally narrow: the production backend will return
 * real CDN URLs in data, and these helpers will only be called from seed/
 * fixture code. Until then, all image URLs in the mock data layer flow
 * through one of these functions.
 *
 * To swap providers (e.g. unsplash, picsum, a local /placeholders folder),
 * change the implementations below — no consumer needs to be touched.
 */

// Use local placeholder images stored under `/public/placeholders` or a
// single fallback image. This ensures no third-party placeholder service
// is used by the mock fixtures.
const LOCAL_PLACEHOLDER = '/Render_image_1.jpg';
const LOCAL_CDN = '/placeholders';

interface ImageOptions {
  query: string;
  width: number;
  height: number;
  seq: string;
  orientation?: 'portrait' | 'landscape' | 'squarish';
}

/**
 * Generate an AI-generated image URL with a stable seed.
 * Same `seq` always produces the same image, so design previews stay
 * consistent across renders and reloads.
 */
export function placeholderImage(opts: ImageOptions): string {
  // Use a single local placeholder image from `/public` to ensure the
  // application never requests external placeholder services. If you
  // want distinct images per `seq`, add files under `/public/placeholders`.
  return LOCAL_PLACEHOLDER;
}

/**
 * Direct CDN URL for project-uploaded files (logos, brand assets, etc.).
 * These are static and don't accept query parameters.
 */
export function placeholderAsset(path: string): string {
  return `${LOCAL_CDN}/${path}`;
}

/**
 * Quick helper for avatar-shaped images (square, small).
 */
export function placeholderAvatar(seed: string, size = 80): string {
  return placeholderImage({
    query: 'professional portrait headshot soft neutral background warm lighting',
    width: size,
    height: size,
    seq: `avatar-${seed}`,
    orientation: 'squarish',
  });
}

/**
 * Quick helper for jewellery design renders (portrait orientation, hi-res).
 */
export function placeholderDesign(seed: string, query = 'luxury jewelery design'): string {
  return placeholderImage({
    query,
    width: 480,
    height: 640,
    seq: seed,
    orientation: 'portrait',
  });
}
