'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Chevrons, Starburst } from '@/components/doodles';
import { ACCENT_BG, ON_ACCENT, Panel, PillButton, PillLink, Tag, type Accent } from '@/components/ui/kit';
import { createClient, supabaseConfigured, type BlindSignal, type Brand, type BrandOverview, type SkuSignal } from '@/lib/supabase';

/**
 * Brand console — the app's Signal screen, on the web.
 *
 * Same rule as the phone: EVERY FIGURE HERE IS MEASURED. There is no synthetic
 * baseline and no demo traffic. When there is nothing to report the screen says
 * so rather than filling itself with plausible numbers, because a dashboard of
 * invented figures proves nothing and undermines the real ones beside it.
 */

/** Same weighting as the app's `frictionOf`, kept in step deliberately. */
function friction(row: SkuSignal): number {
  const dwellPressure = Math.min(1, (row.median_dwell_ms ?? 0) / 6000) * 100;
  return Math.round(
    0.3 * dwellPressure +
      0.25 * (row.inspect_rate ?? 0) +
      0.3 * (row.hesitation_rate ?? 0) +
      0.15 * (row.undo_rate ?? 0),
  );
}

function note(row: SkuSignal): string | null {
  if ((row.hesitation_rate ?? 0) >= 50) return 'Started to add it, then pulled back';
  if ((row.undo_rate ?? 0) >= 50) return 'Added, then taken back out';
  if ((row.inspect_rate ?? 0) >= 50) return 'Had to open the detail before deciding';
  if ((row.median_dwell_ms ?? 0) >= 8000)
    return `Deliberated ${((row.median_dwell_ms ?? 0) / 1000).toFixed(1)}s`;
  return null;
}

export default function BrandConsole() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [overview, setOverview] = useState<BrandOverview | null>(null);
  const [skus, setSkus] = useState<SkuSignal[]>([]);
  const [blind, setBlind] = useState<BlindSignal | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured()) {
      setProblem('Supabase is not configured on this deployment.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.replace('/brands/login');
      return;
    }
    setEmail(sessionData.session.user.email ?? null);

    try {
      const { data: brandRows } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', sessionData.session.user.id)
        .limit(1);

      const mine = (brandRows?.[0] ?? null) as Brand | null;
      setBrand(mine);

      if (!mine) {
        setLoading(false);
        return;
      }

      const [overviewRes, skuRes, blindRes] = await Promise.all([
        supabase.from('brand_overview').select('*').eq('brand', mine.name).single(),
        supabase.from('sku_signal').select('*').eq('brand', mine.name),
        // maybeSingle, not single: a brand with no swipes yet returns zero rows,
        // and single() treats that as an error that would take down the whole
        // console for the brands who need onboarding most.
        supabase.from('blind_signal').select('*').eq('brand', mine.name).maybeSingle(),
      ]);

      setBlind((blindRes.data ?? null) as BlindSignal | null);
      setOverview((overviewRes.data ?? null) as BrandOverview | null);
      setSkus(((skuRes.data ?? []) as SkuSignal[]).sort((a, b) => friction(b) - friction(a)));
    } catch {
      setProblem('Could not load your console. The telemetry schema may not be applied yet.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/brands/login');
  };

  if (loading) {
    return (
      <section className="grid-paper min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <p className="label text-[12px] opacity-60">Loading console…</p>
        </div>
      </section>
    );
  }

  const accent = (brand?.accent ?? 'violet') as Accent;
  const hasData = (overview?.decisions ?? 0) > 0;

  return (
    <section className="grid-paper min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-6xl px-5 py-14">
        {/* Header ---------------------------------------------------- */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Chevrons size={44} fill="#1F8D42" />
              <span className="label text-[12px] opacity-60">Brand console</span>
            </div>
            <h1 className="display mt-3 text-[clamp(38px,6vw,64px)]">
              {brand?.name ?? 'Signal'}
            </h1>
            {email && <p className="mt-2 text-[13px] opacity-60">{email}</p>}
          </div>

          <div className="flex items-center gap-3">
            {brand && !brand.approved && <Tag accent="acid">Pending review</Tag>}
            <PillButton type="button" accent="paper" size="md" onClick={() => void signOut()}>
              Sign out
            </PillButton>
          </div>
        </div>

        {problem && (
          <Panel tone="tomato" className="mt-8 p-6">
            <p className="text-[15px]">{problem}</p>
          </Panel>
        )}

        {/* No brand claimed ------------------------------------------ */}
        {!brand && !problem && (
          <Panel className="mt-10 p-8">
            <h2 className="display text-[26px]">No brand on this account</h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed">
              This login has no brand claim attached yet. Claim one and your console populates as
              soon as shoppers start seeing your pieces.
            </p>
            <div className="mt-6">
              <PillLink href="/brands/join" accent="violet">
                Claim a brand
              </PillLink>
            </div>
          </Panel>
        )}

        {/* The honesty line, before any number ----------------------- */}
        {brand && (
          <>
            <div className="mt-10 rounded-[13px] border border-black bg-[#1F8D42] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-white">
                100% measured · {overview?.decisions ?? 0} decision
                {(overview?.decisions ?? 0) === 1 ? '' : 's'} recorded. No synthetic baseline, no
                demo traffic.
              </p>
            </div>

            {!hasData ? (
              <Panel className="mt-8 p-10 text-center">
                <div className="flex justify-center">
                  <Starburst size={78} fill="#EBD22F" rotate={-12} />
                </div>
                <h2 className="display mt-6 text-[28px]">Nothing measured yet</h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
                  This console reports only what actually happened. As soon as shoppers see your
                  pieces in the app, the numbers appear — there is no demo data behind it.
                </p>
              </Panel>
            ) : (
              <>
                {/* Stats ------------------------------------------- */}
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Keep rate" value={`${(overview?.keep_rate ?? 0).toFixed(0)}%`} tone="violet" />
                  <Stat
                    label="Median decision"
                    value={`${((overview?.median_dwell_ms ?? 0) / 1000).toFixed(1)}s`}
                    tone="tomato"
                  />
                  <Stat label="Hesitated" value={`${(overview?.hesitation_rate ?? 0).toFixed(0)}%`} tone="acid" />
                  <Stat label="Handoffs" value={String(overview?.handoffs ?? 0)} tone="forest" />
                </div>

                {/* Friction ---------------------------------------- */}
                <Panel className="mt-8 p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="display text-[26px]">Decision friction</h2>
                    <span className="text-[12px] uppercase tracking-[0.06em] opacity-60">
                      {skus.length} SKU{skus.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-[13px] leading-relaxed opacity-70">
                    Dwell time, detail-opens, threshold retreats and reversals — the moments before
                    a return, and the ones your own analytics cannot observe.
                  </p>

                  <div className="mt-7 space-y-5">
                    {skus.map((row) => {
                      const score = friction(row);
                      const flag = note(row);
                      return (
                        <div key={row.product_id}>
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="truncate text-[13px] font-semibold uppercase tracking-[0.04em]">
                              {row.product_id.replace(/-/g, ' ')}
                            </span>
                            <span className="text-[13px] font-semibold">{score}</span>
                          </div>
                          <div className="mt-1.5 h-4 overflow-hidden rounded-full border border-black bg-white">
                            <div
                              className={`h-full ${ACCENT_BG[accent]}`}
                              style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
                            />
                          </div>
                          <div className="mt-1.5 text-[12px] opacity-65">
                            {((row.median_dwell_ms ?? 0) / 1000).toFixed(1)}s
                            {(row.inspect_rate ?? 0) > 0 && ` · opened detail ${(row.inspect_rate ?? 0).toFixed(0)}%`}
                            {(row.hesitation_rate ?? 0) > 0 && ` · hesitated ${(row.hesitation_rate ?? 0).toFixed(0)}%`}
                            {(row.undo_rate ?? 0) > 0 && ` · reversed ${(row.undo_rate ?? 0).toFixed(0)}%`}
                            {flag && <span className="ml-1 font-semibold">· {flag}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </>
            )}

            <BlindPanel blind={blind} />

            <Panel tone={accent} className="mt-8 p-7">
              <h2 className="display text-[24px]">What you are buying</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed">
                FITCHECK takes no cut of the sale. It sells the layer above it: which garment a
                shopper pictured on themselves, which ones they hesitated over, and why they
                stopped — including the returns you never find out about because the shopper simply
                never bought.
              </p>
            </Panel>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The measurement no retailer can run on their own shop.
 *
 * In any ordinary store the shopper can always see whose product they are
 * holding, so brand pull and garment appeal arrive fused and cannot be
 * separated afterwards. FITCHECK can hide the label before the decision, which
 * makes the two separable — and the gap between the two keep rates is the price
 * of the name, stated as a number.
 *
 * MIN_SAMPLE mirrors the app's analytics rather than being chosen here: a brand
 * comparing 2 blind swipes against 3 revealed ones would be reading noise, and
 * a dashboard that presents noise confidently is worse than one that admits it
 * is still counting.
 */
const MIN_SAMPLE = 3;

function BlindPanel({ blind }: { blind: BlindSignal | null }) {
  if (!blind) return null;

  const ready =
    blind.blind_seen >= MIN_SAMPLE &&
    blind.revealed_seen >= MIN_SAMPLE &&
    blind.blind_keep_rate !== null &&
    blind.revealed_keep_rate !== null;

  if (!ready) {
    return (
      <Panel className="mt-8 p-7">
        <Tag accent="acid">Not obtainable elsewhere</Tag>
        <h2 className="display mt-4 text-[24px]">Brand blindness</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed">
          Shoppers can switch your label off before deciding. Once{' '}
          {MIN_SAMPLE} decisions have landed on each side, this will show what
          your name is worth — the gap between the keep rate with it hidden and
          with it shown.
        </p>
        <p className="mt-3 text-[13px] opacity-70">
          So far: {blind.blind_seen} blind, {blind.revealed_seen} revealed.
        </p>
      </Panel>
    );
  }

  const gap = (blind.revealed_keep_rate ?? 0) - (blind.blind_keep_rate ?? 0);
  const premium = gap >= 0;

  return (
    <Panel className="mt-8 p-7">
      <Tag accent="acid">Not obtainable elsewhere</Tag>
      <h2 className="display mt-4 text-[24px]">Brand blindness</h2>

      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed">
        With your label hidden, shoppers kept the garment{' '}
        <strong>{blind.blind_keep_rate?.toFixed(0)}%</strong> of the time. With it shown,{' '}
        <strong>{blind.revealed_keep_rate?.toFixed(0)}%</strong>.
      </p>

      <div
        className={`mt-5 inline-block rounded-[13px] border-2 border-black px-5 py-3 shadow-hard-sm ${
          premium ? 'bg-[#1F8D42] text-white' : 'bg-[#E9492D] text-white'
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-85">
          {premium ? 'Brand premium' : 'Brand penalty'}
        </div>
        <div className="display mt-1 text-[36px] leading-none">
          {premium ? '+' : '−'}
          {Math.abs(gap).toFixed(0)} pts
        </div>
      </div>

      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed">
        {premium
          ? 'Your name is doing work the garment alone would not. That is real equity, and it is what a discount erodes first.'
          : 'The garment outperforms its own label here. Something about how the name is landing is costing you decisions the product had already won.'}
      </p>

      <p className="mt-3 text-[13px] opacity-70">
        {blind.blind_seen} blind · {blind.revealed_seen} revealed
      </p>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: Accent }) {
  return (
    <div
      className={`rounded-[13px] border-2 border-black p-5 shadow-hard-sm ${ACCENT_BG[tone]} ${ON_ACCENT[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-85">{label}</div>
      <div className="display mt-1 text-[36px] leading-none">{value}</div>
    </div>
  );
}
