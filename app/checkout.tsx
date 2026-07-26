import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { brandAccent, formatPrice } from '@/data/catalog';
import { groupCartByBrand, useAppStore } from '@/store/useAppStore';
import { border, color, motion, onAccent, radius, space } from '@/theme/tokens';
import { Cursor, Globe, IconArrow } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Tap } from '@/ui/Tap';
import { Type } from '@/ui/Type';

/**
 * Handoff, not checkout.
 *
 * There is no payment path here and there is not meant to be one — the product
 * is a discovery layer in front of existing retail, which is what makes brands
 * partners rather than competitors. Every button on this screen opens the
 * brand's own product page, and the copy says so plainly rather than dressing
 * a redirect up as a purchase.
 */
export default function Checkout() {
  const router = useRouter();
  const cart = useAppStore((s) => s.cart);
  const groups = useMemo(() => groupCartByBrand(cart), [cart]);
  const markSentToBrand = useAppStore((s) => s.markSentToBrand);

  const [opening, setOpening] = useState<string | null>(null);

  const openOne = async (url: string, productId: string) => {
    setOpening(productId);
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: color.ground,
        controlsColor: color.ink,
      });
      markSentToBrand([productId]);
    } catch {
      // A browser that refuses to open is not worth an error screen; the row
      // simply stays unmarked and can be tapped again.
    } finally {
      setOpening(null);
    }
  };

  const openBrand = async (items: { product: { id: string; brandProductUrl: string } }[]) => {
    // Sequential rather than parallel: the system browser can only surface one
    // page at a time, and firing them together silently drops all but the last.
    for (const item of items) {
      await WebBrowser.openBrowserAsync(item.product.brandProductUrl, {
        toolbarColor: color.ground,
        controlsColor: color.ink,
      });
    }
    markSentToBrand(items.map((i) => i.product.id));
  };

  if (groups.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Type role="display">Nothing to hand off</Type>
          <PillButton label="Back" onPress={() => router.back()} variant="outline" fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl, gap: space.md }}>
        <View style={{ paddingTop: space.md, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Globe size={40} fill={color.forest} rotate={8} />
            <Type role="display" style={{ flex: 1 }}>
              Handoff
            </Type>
          </View>
          <Type role="body">
            We don't take payment. Tap a brand and we'll open their real product
            pages so you can buy where you'd normally buy.
          </Type>
        </View>

        {groups.map(({ brand, items }) => {
          const accentName = brandAccent(brand);
          const accent = color[accentName];
          const accentText = onAccent(accentName);
          const total = items.reduce((s, i) => s + i.product.price, 0);

          return (
            <Shadowed key={brand} radius={radius.lg}>
              <View
                style={{
                  backgroundColor: color.paper,
                  borderWidth: border.bold,
                  borderColor: color.ink,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    backgroundColor: accent,
                    padding: space.md,
                    borderBottomWidth: border.bold,
                    borderBottomColor: color.ink,
                    gap: space.xxs,
                  }}
                >
                  <Type role="title" color={accentText}>
                    {brand}
                  </Type>
                  <Type role="label" color={accentText} style={{ opacity: 0.85 }}>
                    {items.length} item{items.length === 1 ? '' : 's'} · ${total.toFixed(0)}
                  </Type>
                </View>

                {items.map((item) => (
                  <Tap
                    key={item.product.id}
                    onPress={() => void openOne(item.product.brandProductUrl, item.product.id)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${item.product.name} on ${brand}'s site`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                      minHeight: 56,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Type role="bodyStrong" numberOfLines={1}>
                        {item.product.name}
                      </Type>
                      <Type role="micro" color={color.inkSoft}>
                        {formatPrice(item.product)} · {item.product.colorName}
                      </Type>
                    </View>
                    {/*
                      Handoff is the whole point of this screen, so the row has
                      to make the transition legible: arrow -> Opening -> Opened.
                      Keyed per state so each one actually mounts and fades in;
                      without the key React reuses the node and the label
                      substitutes itself in place, which reads as a glitch rather
                      than a confirmation.
                    */}
                    <Animated.View
                      key={item.sentToBrand ? 'sent' : opening === item.product.id ? 'opening' : 'idle'}
                      entering={FadeIn.duration(motion.base)}
                    >
                      {item.sentToBrand ? (
                        <PillTag label="Opened" tone={color.forest} labelColor={color.paper} />
                      ) : opening === item.product.id ? (
                        <PillTag label="Opening" tone={color.acid} />
                      ) : (
                        <IconArrow size={20} />
                      )}
                    </Animated.View>
                  </Tap>
                ))}

                <View style={{ padding: space.md, paddingTop: space.xs }}>
                  <PillButton
                    label={`Open all ${items.length}`}
                    onPress={() => void openBrand(items)}
                    tone={accent}
                    labelColor={accentText}
                    size="md"
                    fullWidth
                  />
                </View>
              </View>
            </Shadowed>
          );
        })}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, marginTop: space.xs }}>
          <Cursor size={24} rotate={128} />
          <Type role="micro" color={color.inkSoft} style={{ flex: 1, opacity: 0.8 }}>
            Every handoff is counted on the brand dashboard — that traffic is what
            FITCHECK sells, instead of taking a cut of the sale.
          </Type>
        </View>

        <PillButton label="Back to the bag" onPress={() => router.back()} variant="outline" fullWidth />
      </ScrollView>
    </Screen>
  );
}
