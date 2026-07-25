import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { ALL_PRODUCTS, brandAccent } from '@/data/catalog';
import { buildDashboard } from '@/logic/analytics';
import { useAppStore } from '@/store/useAppStore';
import { border, color, onAccent, radius, space, type AccentName } from '@/theme/tokens';
import { Chevrons } from '@/ui/doodles';
import { PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Type } from '@/ui/Type';

/**
 * Brand console.
 *
 * The business model, made inspectable rather than described. Deliberately more
 * data-dense and more restrained than the shopper surfaces — it is a different
 * reader doing a different job — while keeping the same ink outlines, hard
 * shadow and type so it still reads as one product.
 *
 * Rows the current session touched are marked LIVE. That is the point of the
 * screen: swipe right on the deck, come here, watch that SKU's bar move.
 */
export default function BrandDashboard() {
  const swipes = useAppStore((s) => s.swipes);
  const cart = useAppStore((s) => s.cart);
  const profile = useAppStore((s) => s.profile);

  const dashboard = useMemo(
    () => buildDashboard(ALL_PRODUCTS, swipes, cart, profile),
    [swipes, cart, profile],
  );

  const { totals, rows } = dashboard;
  const liveRows = rows.filter((r) => r.live);
  const flagged = rows.filter((r) => r.frictionFlag);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <View style={{ paddingTop: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Type role="label">Brand console</Type>
          <Type role="display">Signal</Type>
        </View>
        <Chevrons size={48} fill={color.forest} rotate={0} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl, gap: space.md }}>
        {/* Stated up front, not in a footnote at the bottom. */}
        <View
          style={{
            padding: space.sm,
            backgroundColor: color.acid,
            borderWidth: border.hair,
            borderColor: color.ink,
            borderRadius: radius.md,
          }}
        >
          <Type role="micro">
            Baseline figures are synthetic demo data. Rows marked LIVE include
            this session's real swipes.
          </Type>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Right-swipe rate" value={`${totals.rightRate.toFixed(1)}%`} tone="violet" />
          <Stat label="Bag → handoff" value={`${totals.handoffRate.toFixed(0)}%`} tone="forest" />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Session swipes" value={String(totals.sessionImpressions)} tone="tomato" live={totals.sessionImpressions > 0} />
          <Stat label="Handed off" value={`${totals.handedOff}/${totals.bagged}`} tone="bubblegum" />
        </View>

        <Section title="Right-swipe rate by SKU" note={`${liveRows.length} live`}>
          <View style={{ gap: space.sm }}>
            {rows.slice(0, 12).map((row) => {
              const accentName = brandAccent(row.product.brand);
              return (
                <View key={row.product.id} style={{ gap: space.xxs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <Type role="micro" style={{ flex: 1 }} numberOfLines={1}>
                      {row.product.brand} · {row.product.name}
                    </Type>
                    {row.live && <PillTag label="Live" tone={color.acid} />}
                    <Type role="micro">{row.rate.toFixed(0)}%</Type>
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
                        width: `${Math.max(2, Math.min(100, row.rate))}%`,
                        height: '100%',
                        backgroundColor: color[accentName],
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Section>

        {flagged.length > 0 && (
          <Section title="Fit friction" note={`${flagged.length} SKUs flagged`}>
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
                      {row.frictionFlag}
                    </Type>
                  </View>
                  <Type role="micro" color={color.inkSoft}>
                    {row.product.sizeInfo}
                  </Type>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="What a partner buys" note="the model">
          <Type role="body">
            FITCHECK takes no cut of the sale. It sells the layer above it: which
            garment a shopper pictured on themselves, which ones they hesitated
            over, and why they stopped — including the returns a brand never
            finds out about because the shopper simply never bought.
          </Type>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  label,
  value,
  tone,
  live,
}: {
  label: string;
  value: string;
  tone: AccentName;
  live?: boolean;
}) {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
          <Type role="micro" color={fg} style={{ opacity: 0.85, flex: 1 }} numberOfLines={1}>
            {label}
          </Type>
          {live && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fg }} />}
        </View>
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
