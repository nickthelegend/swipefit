import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * Only the pages a stranger should land on. The console and login are omitted
 * for the same reason robots.ts disallows them: they are useless without an
 * account, and indexing them wastes crawl budget on a redirect.
 *
 * lastModified is deliberately absent rather than `new Date()`. Stamping every
 * URL with the build time claims all six pages changed on every deploy, which
 * teaches crawlers to distrust the signal.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/brands`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/download`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/brands/join`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
