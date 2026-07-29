import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client.
 *
 * PUBLISHABLE KEY ONLY. The service-role key bypasses Row Level Security
 * entirely; putting it anywhere reachable from the browser bundle would hand
 * full read/write on the database to any visitor who opens devtools.
 *
 * Every table this touches is protected by RLS (see supabase/migrations), so
 * the anon key can do exactly what an anonymous visitor should be able to do
 * and nothing else.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = () => URL.length > 0 && ANON.length > 0;

export function createClient() {
  return createBrowserClient(URL, ANON);
}

export type Brand = {
  id: string;
  name: string;
  slug: string;
  accent: 'violet' | 'tomato' | 'acid' | 'forest';
  blurb: string | null;
  website: string | null;
  approved: boolean;
  owner_id: string | null;
};

export type BrandOverview = {
  brand: string;
  slug: string;
  accent: 'violet' | 'tomato' | 'acid' | 'forest';
  decisions: number;
  kept: number;
  keep_rate: number | null;
  median_dwell_ms: number;
  inspect_rate: number | null;
  hesitation_rate: number | null;
  undo_rate: number | null;
  handoffs: number;
};

/**
 * One row per brand from the `blind_signal` view.
 *
 * Keep rate with the label hidden against keep rate with it shown. Rates are
 * null until that side has been seen at all — a brand that has only ever been
 * swiped blind has no revealed rate to compare against, and 0 would read as
 * "nobody wants it" rather than "not measured yet".
 */
export type BlindSignal = {
  brand: string;
  blind_seen: number;
  revealed_seen: number;
  blind_keep_rate: number | null;
  revealed_keep_rate: number | null;
};

export type SkuSignal = {
  product_id: string;
  brand: string;
  impressions: number;
  rights: number;
  right_rate: number | null;
  median_dwell_ms: number;
  inspect_rate: number | null;
  hesitation_rate: number | null;
  undo_rate: number | null;
};
