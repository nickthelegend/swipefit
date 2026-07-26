import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { ALL_PRODUCTS, brandAccent } from '@/data/catalog';
import { buildDashboard, colourVerdict, type SkuRow } from '@/logic/analytics';
import { useAppStore } from '@/store/useAppStore';
import { border, color, onAccent, radius, space, type AccentName } from '@/theme/tokens';
import { Chevrons, Starburst } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Type } from '@/ui/Type';

/**
 * Brand console.
 *
 * Every figure here is measured from real swipes on this device. An earlier
 * version padded the screen with a synthetic traffic baseline; that was deleted
 * rather than relabelled, because invented numbers prove nothing and quietly
 * undermine the real ones sitting next to them.
 *
 * The argument this screen makes: a retailer already knows its conversion rate.
 * What it has never been able to see is the hesitation *before* the buy — and
 * that is where returns are born.
 */
export default function BrandDashboard() {
  const router = useRouter();
  const swipes = useAppStore((s) => s.swipes);
  const cart = useAppStore((s) => s.cart);
  const profile = useAppStore((s) => s.profile);

  const dashboard = useMemo(
    () => buildDashboard(ALL_PRODUCTS, swipes, cart, profile),
    [swipes, cart, profile],
  );
  const colour = useMemo(() => colourVerdict(ALL_PRODUCTS, swipes, profile), [swipes, profile]);

  const { totals, rows, hasData } = dashboard;

  if (!hasData) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <Starburst size={92} fill={color.forest} rotate={-12} />
          <Type role="display" align="center">
            Nothing measured yet
          </Type>
          <Type role="body" align="center" style={{ maxWidth: 300 }}>
            This console reports only what actually happened. Swipe a few cards and the numbers
            appear — there is no demo data behind it.
          </Type>
          <PillButton label="Go swipe" onPress={() => router.push('/(app)/swipe')} tone={color.forest} />
        </View>
      </Screen>
    );
  }

  const flagged = rows.filter((r) => r.frictionNote);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <View style={{ paddingTop: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Type role="label">Brand console</Type>
          <Type role="display">Signal</Type>
        </View>
        <Chevrons size={48} fill={color.forest} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl, gap: space.md }}>
        {/* The claim, stated before any number is shown. */}
        <View
          style={{
            padding: space.sm,
            backgroundColor: color.forest,
            borderWidth: border.hair,
            borderColor: color.ink,
            borderRadius: radius.md,
          }}
        >
          <Type role="micro" color={color.paper}>
            100% measured · {totals.impressions} decision{totals.impressions === 1 ? '' : 's'} on this
            device. No synthetic baseline, no demo traffic.
          </Type>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Right-swipe rate" value={`${totals.rightRate.toFixed(0)}%`} tone="violet" />
          <Stat label="Median decision" value={`${(totals.medianDwellMs / 1000).toFixed(1)}s`} tone="tomato" />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Hesitated" value={`${totals.hesitationRate.toFixed(0)}%`} tone="acid" />
          <Stat label="Bag → handoff" value={`${totals.handoffRate.toFixed(0)}%`} tone="bubblegum" />
        </View>

        {/* The measurement only this product can produce. */}
        {colour && (
          <Section title="Colour rejection" note="only visible here">
            {colour.significant ? (
              <Type role="body">
                Pieces whose colour fights this shopper's undertone were kept{' '}
                <Type role="bodyStrong">{colour.foughtRightRate.toFixed(0)}%</Type> of the time.
                Pieces that flatter it were kept{' '}
                <Type role="bodyStrong">{colour.flatteredRightRate.toFixed(0)}%</Type>.
              </Type>
            ) : (
              <Type role="body">
                Seen so far: <Type role="bodyStrong">{colour.fought}</Type> fighting this
                shopper's undertone, <Type role="bodyStrong">{colour.flattered}</Type> flattering
                it. Rates appear once there are at least three of each — a percentage off one
                swipe would be noise dressed as a finding.
              </Type>
            )}
            <Type role="micro" color={color.inkSoft} style={{ opacity: 0.75 }}>
              Judged against a measured skin reading. Ordinary retail analytics cannot see this,
              because the shoppers who reject a colourway never click anything.
            </Type>
          </Section>
        )}

        <Section title="Decision friction" note={`${rows.length} SKU${rows.length === 1 ? '' : 's'}`}>
          <Type role="micro" color={color.inkSoft} style={{ marginBottom: space.xs }}>
            Dwell time, detail-opens, threshold retreats and reversals — the moments before a return.
          </Type>
          <View style={{ gap: space.sm }}>
            {rows.slice(0, 10).map((row) => (
              <FrictionRow key={row.product.id} row={row} />
            ))}
          </View>
        </Section>

        {flagged.length > 0 && (
          <Section title="Flagged" note={`${flagged.length}`}>
            <View style={{ gap: space.xs }}>
              {flagged.slice(0, 6).map((row) => (
                <View
                  key={row.product.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.xs,
                    paddingVertical: space.xs,
                    borderTopWidth: border.hair,
                    borderTopColor: color.groundSunk,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: color.tomato,
                      borderWidth: border.hair,
                      borderColor: color.ink,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Type role="bodyStrong" numberOfLines={1}>
                      {row.product.name}
                    </Type>
                    <Type role="micro" color={color.inkSoft}>
                      {row.frictionNote}
                    </Type>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="What a partner buys" note="the model">
          <Type role="body">
            FITCHECK takes no cut of the sale. It sells the layer above it: which garment a shopper
            pictured on themselves, which ones they hesitated over, and why they stopped — including
            the returns a brand never finds out about because the shopper simply never bought.
          </Type>
        </Section>
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------------- */

function FrictionRow({ row }: { row: SkuRow }) {
  const accentName = brandAccent(row.product.brand);

  return (
    <View style={{ gap: space.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Type role="micro" style={{ flex: 1 }} numberOfLines={1}>
          {row.product.brand} · {row.product.name}
        </Type>
        {row.addedToBag && <PillTag label="Kept" tone={color.forest} labelColor={color.paper} />}
        <Type role="micro">{row.friction}</Type>
      </View>

      <View
        style={{
          height: 16,
          borderWidth: border.hair,
          borderColor: color.ink,
          borderRadius: radius.pill,
          backgroundColor: color.paper,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(2, Math.min(100, row.friction))}%`,
            height: '100%',
            backgroundColor: color[accentName],
          }}
        />
      </View>

      <Type role="micro" color={color.inkSoft} style={{ opacity: 0.7 }}>
        {(row.medianDwellMs / 1000).toFixed(1)}s
        {row.inspectRate > 0 ? ` · opened detail ${row.inspectRate.toFixed(0)}%` : ''}
        {row.hesitationRate > 0 ? ` · hesitated ${row.hesitationRate.toFixed(0)}%` : ''}
        {row.undoRate > 0 ? ` · reversed ${row.undoRate.toFixed(0)}%` : ''}
      </Type>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: AccentName }) {
  const fg = onAccent(tone);

  return (
    <Shadowed radius={radius.md} offset={{ x: 3, y: 4 }} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: color[tone],
          borderWidth: border.bold,
          borderColor: color.ink,
          borderRadius: radius.md,
          padding: space.sm,
          gap: 2,
          minHeight: 84,
          justifyContent: 'center',
        }}
      >
        <Type role="micro" color={fg} style={{ opacity: 0.85 }} numberOfLines={2}>
          {label}
        </Type>
        <Type role="title" color={fg}>
          {value}
        </Type>
      </View>
    </Shadowed>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Shadowed radius={radius.lg}>
      <View
        style={{
          backgroundColor: color.paper,
          borderWidth: border.bold,
          borderColor: color.ink,
          borderRadius: radius.lg,
          padding: space.md,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
          <Type role="heading" style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </Type>
          {note && (
            <Type role="micro" color={color.inkSoft} numberOfLines={1} style={{ flexShrink: 0 }}>
              {note}
            </Type>
          )}
        </View>
        {children}
      </View>
    </Shadowed>
  );
}
