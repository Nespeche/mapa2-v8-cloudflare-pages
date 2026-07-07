import { DATA_MANIFEST } from './dataManifest';

export const INITIAL_DATA_PATHS = DATA_MANIFEST.initial;

export const LAZY_DATA_PATHS = DATA_MANIFEST.lazy;

export function assetUrl(relativePath: string): string {
  const normalizedBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const normalizedPath = relativePath.replace(/^\//, '');
  return `${normalizedBase}${normalizedPath}`;
}
