import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * The brand console is behind a login and holds partner data. It is excluded
 * here as well as being access-controlled, because a disallowed path is the
 * difference between "a crawler cannot index it" and "a crawler tries, gets a
 * redirect, and indexes the login page under the console's URL".
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/brands/console', '/brands/login'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
