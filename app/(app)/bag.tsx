import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Share, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { brandAccent, formatPrice } from '@/data/catalog';
import { groupCartByBrand, useAppStore } from '@/store/useAppStore';
import { border, color, onAccent, radius, space } from '@/theme/tokens';
import { Globe, IconShare, IconX } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Tap } from '@/ui/Tap';
import { Type } from '@/ui/Type';

/**
 * The bag, grouped by brand.
 *
 * Brand grouping is the structure rather than a sort option, because the
 * checkout is a per-brand handoff — the group *is* the unit of action. Each
 * group wears its brand's accent, which is the same colour that brand had on
 * the deck and will have on the dashboard.
 */
export default function Bag() {
  const router = useRouter();
  const cart = useAppStore((s) => s.cart);
  const groups = useMemo(() => groupCartByBrand(cart), [cart]);
  const removeFromCart = useAppStore((s) => s.removeFromCart);

  const total = cart.reduce((sum, item) => sum + item.product.price, 0);

  /**
   * Hands the bag to whatever the OS can hand it to.
   *
   * Plain text with real product URLs rather than a deep link into this app,
   * because the recipient almost certainly does not have it installed — a link
   * that only opens for people who already have the app is a link that mostly
   * fails. Grouped by brand so the message reads like a list someone wrote.
   *
   * Share.share resolves on dismissal as well as on send, so there is nothing
   * useful to report back and no error state to design.
   */
  const shareBag = async () => {
    const lines = groups.flatMap(({ brand, items }) => [
      `${brand}`,
      ...items.map((i) => `  ${i.product.name} — ${formatPrice(i.product)}`),
      ...items.map((i) => `  ${i.product.brandProductUrl}`),
      '',
    ]);

    try {
      await Share.share({
        title: 'My FITCHECK bag',
        message: [
          `${cart.length} piece${cart.length === 1 ? '' : 's'} · $${total.toFixed(0)}`,
          '',
          ...lines,
          'Picked with FITCHECK — every card rendered on my own body.',
        ].join('\n'),
      });
    } catch {
      // The sheet failing to open is not worth interrupting anyone over.
    }
  };

  // A full look needs both halves; offering the builder without them would lead
  // straight to a dead end.
  const canBuildLook =
    cart.some((i) => i.product.category === 'upper_body') &&
    cart.some((i) => i.product.category === 'lower_body');

  if (cart.length === 0) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <Globe size={96} fill={color.violet} rotate={-8} />
          <Type role="display" align="center">
            Bag’s empty
          </Type>
          <Type role="body" align="center" style={{ maxWidth: 280 }}>
            Swipe right on something and it lands here, sorted by brand.
          </Type>
          <PillButton label="Back to the deck" onPress={() => router.push('/(app)/swipe')} tone={color.violet} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <View style={{ paddingTop: space.xs, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Type role="label">Your bag</Type>
          <Type role="mega">{cart.length}</Type>
        </View>
        <View style={{ alignItems: 'flex-end', gap: space.xxs, paddingBottom: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Tap
              onPress={() => void shareBag()}
              accessibilityRole="button"
              accessibilityLabel={`Share your bag of ${cart.length} item${cart.length === 1 ? '' : 's'}`}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: border.hair,
                borderColor: color.ink,
                borderRadius: radius.pill,
              }}
            >
              <IconShare size={16} />
            </Tap>
            <PillTag label={`${groups.length} brand${groups.length === 1 ? '' : 's'}`} tone={color.acid} />
          </View>
          <Type role="title">${total.toFixed(0)}</Type>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl, gap: space.md }}>
        {groups.map(({ brand, items }) => {
          const accentName = brandAccent(brand);
          const accent = color[accentName];
          const accentText = onAccent(accentName);

          return (
            <Animated.View key={brand} layout={LinearTransition.springify()} entering={FadeIn.duration(220)}>
              <Shadowed radius={radius.lg}>
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
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottomWidth: border.bold,
                      borderBottomColor: color.ink,
                    }}
                  >
                    <Type role="heading" color={accentText}>
                      {brand}
                    </Type>
                    <Type role="label" color={accentText}>
                      {items.length} item{items.length === 1 ? '' : 's'}
                    </Type>
                  </View>

                  {items.map((item, i) => (
                    <View
                      key={item.product.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        padding: space.sm,
                        borderTopWidth: i === 0 ? 0 : border.hair,
                        borderTopColor: color.groundSunk,
                      }}
                    >
                      <View
                        style={{
                          width: 62,
                          height: 78,
                          borderRadius: radius.sm,
                          borderWidth: border.hair,
                          borderColor: color.ink,
                          overflow: 'hidden',
                          backgroundColor: color.paper,
                        }}
                      >
                        <Image
                          source={{ uri: item.renderUri ?? item.product.productImageUrl }}
                          style={{ flex: 1 }}
                          contentFit="cover"
                        />
                      </View>

                      <View style={{ flex: 1, gap: 3 }}>
                        <Type role="bodyStrong" numberOfLines={2}>
                          {item.product.name}
                        </Type>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                          <View
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              backgroundColor: item.product.colorHex,
                              borderWidth: border.hair,
                              borderColor: color.ink,
                            }}
                          />
                          <Type role="micro" color={color.inkSoft}>
                            {item.product.colorName} · {formatPrice(item.product)}
                          </Type>
                        </View>
                        {item.sentToBrand && <PillTag label="Sent to brand" tone={color.forest} labelColor={color.paper} />}
                      </View>

                      <Tap
                        onPress={() => removeFromCart(item.product.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.product.name}`}
                        hitSlop={12}
                        style={{
                          width: 40,
                          height: 40,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: border.hair,
                          borderColor: color.ink,
                          borderRadius: radius.pill,
                        }}
                      >
                        <IconX size={14} />
                      </Tap>
                    </View>
                  ))}
                </View>
              </Shadowed>
            </Animated.View>
          );
        })}

        <View style={{ marginTop: space.xs, gap: space.sm }}>
          {canBuildLook && (
            <PillButton
              label="Build the fit"
              onPress={() => router.push('/outfit')}
              tone={color.acid}
              labelColor={color.ink}
              fullWidth
            />
          )}
          <PillButton
            label="Hand off to brands"
            onPress={() => router.push('/checkout')}
            tone={color.violet}
            fullWidth
          />
          <Type role="micro" color={color.inkSoft} align="center" style={{ opacity: 0.75 }}>
            FITCHECK never takes payment. Each item opens on the brand’s own site.
          </Type>
        </View>
      </ScrollView>
    </Screen>
  );
}
