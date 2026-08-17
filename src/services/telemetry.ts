import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { hexToLch } from '@/logic/color';
import type { CartItem, SkinProfile, SwipeEvent } from '@/types';

/**
 * Telemetry sync.
 *
 * The brand console measures real behaviour, but on-device that means one
 * person and one session — true, and far too small to be a finding. This module
 * pushes the same measurements to Supabase so the console can report across
 * every session and device, which is the difference between "here is what I
 * did" and "here is what shoppers do".
 *
 * TWO RULES, both load-bearing:
 *
 * 1. Only the PUBLISHABLE (anon) key ever appears here. The service-role key
 *    bypasses Row Level Security entirely — shipping it in a mobile bundle
 *    would hand full read/write on the database to anyone who unzips the APK.
 *
 * 2. Telemetry never blocks and never throws into the UI. Every call is
 *    fire-and-forget and swallows its own failures. A shopper mid-swipe must
 *    not be interrupted because an analytics insert timed out.
 *
 * No photograph is ever uploaded. The skin reading is reduced to L* plus the
 * derived undertone bucket — enough to segment a cohort, not enough to
 * reconstruct a face.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const DEVICE_KEY = 'swipefit.deviceId';

export const telemetryConfigured = () =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!telemetryConfigured()) return null;
  if (!client) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // There are no user accounts. Disabling session persistence stops the
        // client from reaching for storage it will never populate.
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch {
      // A malformed URL makes createClient throw synchronously. Callers invoke
      // this outside their try blocks, so letting it escape would surface as an
      // unhandled rejection — telemetry taking the app down is the one outcome
      // this module exists to prevent.
      return null;
    }
  }
  return client;
}

/* -------------------------------------------------------------------------
 * Identity
 * ---------------------------------------------------------------------- */

let deviceIdCache: string | null = null;

/** Random, local, and not derived from any hardware identifier. */
async function deviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);
    if (stored) {
      deviceIdCache = stored;
      return stored;
    }
  } catch {
    // Fall through and mint a fresh one for this launch.
  }
  const fresh = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  deviceIdCache = fresh;
  void AsyncStorage.setItem(DEVICE_KEY, fresh).catch(() => {});
  return fresh;
}

/* -------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------- */

/**
 * Opens a session row for a scanned profile and returns its id.
 *
 * Returns null on any failure, which callers treat as "sync is off" rather than
 * as an error worth surfacing.
 */
export async function openSession(profile: SkinProfile): Promise<string | null> {
  const supabase = db();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        device_id: await deviceId(),
        undertone: profile.undertone,
        depth: profile.depth,
        season: profile.season,
        // Lightness only — never the measured hex.
        skin_l: Math.round(hexToLch(profile.skinHex).L * 10) / 10,
        reading_source: profile.readingSource,
      })
      .select('id')
      .single();

    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

type BrandLookup = (productId: string) => string;

/**
 * Pushes swipes that have not been sent yet.
 *
 * `client_key` is a stable per-event id with a uniqueness constraint behind it,
 * so a retry after a dropped connection cannot double-count a decision — which
 * would quietly corrupt every rate on the console.
 */
/**
 * Set once the database is known to predate migration 0003.
 *
 * `blind` was added after the first schema shipped. Sending a column the table
 * does not have fails the WHOLE insert, so a deployment running older SQL would
 * silently lose every event rather than just that one field. Detect it once,
 * then drop the column for the rest of the session.
 */
let blindColumnMissing = false;

export async function syncSwipes(
  sessionId: string,
  events: SwipeEvent[],
  brandOf: BrandLookup,
): Promise<number> {
  const supabase = db();
  if (!supabase || events.length === 0) return 0;

  const build = (withBlind: boolean) =>
    events.map((e) => ({
      session_id: sessionId,
      product_id: e.productId,
      brand: brandOf(e.productId),
      direction: e.direction,
      match_score: e.matchScore,
      dwell_ms: Math.max(0, Math.round(e.dwellMs ?? 0)),
      inspected: e.inspected === true,
      hesitated: e.hesitated === true,
      confirmed: e.confirmed === true,
      undone: e.undone === true,
      client_key: `${e.productId}:${e.timestamp}`,
      ...(withBlind ? { blind: e.blind === true } : {}),
    }));

  const push = (rows: ReturnType<typeof build>) =>
    supabase
      .from('swipe_events')
      .upsert(rows, { onConflict: 'session_id,client_key', ignoreDuplicates: true });

  try {
    const { error } = await push(build(!blindColumnMissing));

    // 42703 is Postgres "undefined column".
    if (error && !blindColumnMissing && error.code === '42703') {
      blindColumnMissing = true;
      const retry = await push(build(false));
      return retry.error ? 0 : events.length;
    }

    return error ? 0 : events.length;
  } catch {
    return 0;
  }
}

export async function syncHandoffs(
  sessionId: string,
  items: CartItem[],
  brandOf: BrandLookup,
): Promise<number> {
  const supabase = db();
  if (!supabase || items.length === 0) return 0;

  try {
    const rows = items.map((i) => ({
      session_id: sessionId,
      product_id: i.product.id,
      brand: brandOf(i.product.id),
      client_key: `${i.product.id}:${i.addedAt}`,
    }));

    const { error } = await supabase
      .from('handoffs')
      .upsert(rows, { onConflict: 'session_id,client_key', ignoreDuplicates: true });

    return error ? 0 : rows.length;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

export type NetworkSku = {
  product_id: string;
  brand: string;
  impressions: number;
  rights: number;
  right_rate: number;
  median_dwell_ms: number;
  inspect_rate: number;
  hesitation_rate: number;
  undo_rate: number;
};

export type NetworkReach = {
  sessions: number;
  devices: number;
  decisions: number;
  handoffs: number;
};

export type NetworkUndertone = {
  undertone: 'warm' | 'cool' | 'neutral';
  product_id: string;
  brand: string;
  impressions: number;
  right_rate: number;
};

/**
 * Aggregate signal across every session.
 *
 * Reads views, not tables — the anon role has no SELECT on the raw rows, so one
 * shopper's individual behaviour cannot be pulled out of the app.
 */
export async function fetchNetworkSignal(): Promise<{
  skus: NetworkSku[];
  reach: NetworkReach | null;
  undertones: NetworkUndertone[];
} | null> {
  const supabase = db();
  if (!supabase) return null;

  try {
    const [skuRes, reachRes, toneRes] = await Promise.all([
      supabase.from('sku_signal').select('*').order('impressions', { ascending: false }).limit(40),
      supabase.from('reach').select('*').single(),
      supabase.from('undertone_signal').select('*').limit(200),
    ]);

    if (skuRes.error && reachRes.error) return null;

    return {
      skus: (skuRes.data ?? []) as NetworkSku[],
      reach: (reachRes.data ?? null) as NetworkReach | null,
      undertones: (toneRes.data ?? []) as NetworkUndertone[],
    };
  } catch {
    return null;
  }
}
