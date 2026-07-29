/**
 * The canonical absolute origin for this deployment.
 *
 * Shared by metadata, robots and the sitemap so they can never disagree about
 * where the site lives — a sitemap advertising one origin while og:image points
 * at another is a silent, hard-to-spot break.
 *
 * No domain is hardcoded because none is owned yet: Vercel supplies its own at
 * build time, and NEXT_PUBLIC_SITE_URL overrides once there is a real one.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
