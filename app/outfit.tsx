import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { brandAccent, formatPrice } from '@/data/catalog';
import { useAppStore } from '@/store/useAppStore';
import { border, color, motion, onAccent, radius, space } from '@/theme/tokens';
import { Chevrons, IconX, Starburst } from '@/ui/doodles';
import { PillButton } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Tap } from '@/ui/Tap';
import { Type } from '@/ui/Type';
import type { CartItem } from '@/types';

/**
 * Build the fit.
 *
 * The deck can only ever show one garment at a time, because the try-on API
 * takes one garment per call — so every card renders a new top over whatever
 * trousers the shopper happened to be photographed in. This screen removes that
 * limit by chaining: the rendered top becomes the input person for the bottom,
 * so the result is a complete outfit on the shopper's own body.
 *
 * It is also the only screen where the product's name is literally true.
 */
export default function OutfitBuilder() {
  const router = useRouter();

  const cart = useAppStore((s) => s.cart);
  const outfits = useAppStore((s) => s.outfits);
  const buildOutfit = useAppStore((s) => s.buildOutfit);
  const removeOutfit = useAppStore((s) => s.removeOutfit);

  const tops = useMemo(() => cart.filter((i) => i.product.category === 'upper_body'), [cart]);
  const bottoms = useMemo(() => cart.filter((i) => i.product.category === 'lower_body'), [cart]);

  const [topId, setTopId] = useState<string | null>(tops[0]?.product.id ?? null);
  const [bottomId, setBottomId] = useState<string | null>(bottoms[0]?.product.id ?? null);

  const current = outfits.find((o) => o.id === `${topId}+${bottomId}`) ?? null;
  const canBuild = topId !== null && bottomId !== null;

  // The result box more than doubles in height when a render lands (200 -> 460).
  // Snapping between the two sizes shoves the pickers below off the screen with
  // no warning; springing the height means the page opens up rather than jumps.
  //
  // Declared above the early return below so hook order stays stable when the
  // bag is missing a half.
  const ready = current?.status === 'ready' && Boolean(current.uri);
  const boxHeight = useSharedValue(ready ? 460 : 200);
  useEffect(() => {
    boxHeight.value = withSpring(ready ? 460 : 200, motion.springLoose);
  }, [ready, boxHeight]);
  const boxStyle = useAnimatedStyle(() => ({ height: boxHeight.value }));

  if (tops.length === 0 || bottoms.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Starburst size={80} fill={color.acid} rotate={-10} />
          <Type role="display">Need both halves</Type>
          <Type role="body">
            A look needs a top and a bottom. You have {tops.length} top
            {tops.length === 1 ? '' : 's'} and {bottoms.length} bottom
            {bottoms.length === 1 ? '' : 's'} in the bag — swipe right on the missing half and come
            back.
          </Type>
          <PillButton label="Back to the deck" onPress={() => router.replace('/(app)/swipe')} tone={color.violet} fullWidth />
          <PillButton label="Close" onPress={() => router.back()} variant="outline" fullWidth />
        </View>
      </Screen>
    );
  }

  const total =
    (tops.find((t) => t.product.id === topId)?.product.price ?? 0) +
    (bottoms.find((b) => b.product.id === bottomId)?.product.price ?? 0);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl, gap: space.md }}>
        <View style={{ paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Chevrons size={44} fill={color.violet} />
          <View style={{ flex: 1 }}>
            <Type role="title">Build the fit</Type>
          </View>
          <Tap
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={{
              width: 44,
              height: 44,
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

        <Type role="body">
          Two try-ons chained together — the rendered top becomes the body the trousers go onto. One
          image, the whole outfit, on you.
        </Type>

        {/* The result. */}
        <Shadowed radius={radius.lg}>
          <Animated.View
            style={[
              {
                backgroundColor: color.paper,
                borderWidth: border.bold,
                borderColor: color.ink,
                borderRadius: radius.lg,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              },
              boxStyle,
            ]}
          >
            {ready && current?.uri ? (
              // The one genuinely high-emotion moment in the app: the shopper's
              // own body wearing a complete outfit. It earns a beat, so the
              // image settles in rather than appearing.
              <Animated.View entering={FadeIn.duration(motion.base)} style={{ width: '100%' }}>
                <Image source={{ uri: current.uri }} style={{ width: '100%', height: 460 }} contentFit="cover" transition={220} />
              </Animated.View>
            ) : current?.status === 'rendering' ? (
              <View style={{ alignItems: 'center', gap: space.sm, padding: space.lg }}>
                <Starburst size={64} fill={color.violet} rotate={8} />
                <Type role="heading" align="center">
                  Layering it on
                </Type>
                <Type role="body" align="center">
                  Two renders back to back. This one takes a moment.
                </Type>
              </View>
            ) : current?.status === 'failed' ? (
              <View style={{ alignItems: 'center', gap: space.sm, padding: space.lg }}>
                <Type role="heading" align="center" color={color.tomato}>
                  Could not build it
                </Type>
                <Type role="body" align="center">
                  {current.reason}
                </Type>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: space.sm, padding: space.lg }}>
                <Type role="heading" align="center">
                  Pick a top and a bottom
                </Type>
                <Type role="body" align="center">
                  Then render the whole look at once.
                </Type>
              </View>
            )}
          </Animated.View>
        </Shadowed>

        <Picker label="Top" items={tops} selectedId={topId} onSelect={setTopId} />
        <Picker label="Bottom" items={bottoms} selectedId={bottomId} onSelect={setBottomId} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Type role="label">Look total</Type>
          <Type role="title">${total.toFixed(0)}</Type>
        </View>

        {current?.status === 'ready' ? (
          <View style={{ gap: space.sm }}>
            <PillButton
              label="Build another"
              onPress={() => removeOutfit(current.id)}
              variant="outline"
              fullWidth
            />
            <PillButton label="Back to the bag" onPress={() => router.back()} tone={color.violet} fullWidth />
          </View>
        ) : (
          <PillButton
            label={current?.status === 'rendering' ? 'Rendering…' : 'Render the look'}
            onPress={() => {
              if (canBuild && topId && bottomId) void buildOutfit(topId, bottomId);
            }}
            tone={color.violet}
            disabled={!canBuild || current?.status === 'rendering'}
            fullWidth
          />
        )}

        {outfits.filter((o) => o.status === 'ready').length > 0 && (
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <Type role="label">Looks you’ve built</Type>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingRight: space.md }}>
              {outfits
                .filter((o) => o.status === 'ready' && o.uri)
                .map((o) => (
                  <Animated.View key={o.id} entering={FadeIn.duration(200)}>
                    <Shadowed radius={radius.md} offset={{ x: 3, y: 4 }}>
                      <Tap
                        feel="travel"
                        offset={{ x: 3, y: 4 }}
                        onPress={() => {
                          setTopId(o.topId);
                          setBottomId(o.bottomId);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Show this look"
                        style={{
                          width: 92,
                          height: 124,
                          borderWidth: border.bold,
                          borderColor: color.ink,
                          borderRadius: radius.md,
                          overflow: 'hidden',
                          backgroundColor: color.paper,
                        }}
                      >
                        <Image source={{ uri: o.uri! }} style={{ flex: 1 }} contentFit="cover" />
                      </Tap>
                    </Shadowed>
                  </Animated.View>
                ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------------- */

function Picker({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: CartItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Type role="label">{label}</Type>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingRight: space.md }}>
        {items.map((item) => {
          const selected = item.product.id === selectedId;
          const accentName = brandAccent(item.product.brand);

          return (
            <Shadowed key={item.product.id} radius={radius.md} offset={{ x: 3, y: 4 }} scale={selected ? 1 : 0.6}>
              <Tap
                onPress={() => onSelect(item.product.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.product.brand} ${item.product.name}`}
                style={{
                  width: 116,
                  borderWidth: selected ? border.bold : border.hair,
                  borderColor: color.ink,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  backgroundColor: color.paper,
                  opacity: selected ? 1 : 0.72,
                }}
              >
                <Image
                  source={{ uri: item.renderUri ?? item.product.productImageUrl }}
                  style={{ width: '100%', height: 128, backgroundColor: color.paper }}
                  contentFit="cover"
                />
                <View
                  style={{
                    backgroundColor: selected ? color[accentName] : color.ground,
                    paddingHorizontal: space.xs,
                    paddingVertical: space.xxs + 2,
                    borderTopWidth: border.hair,
                    borderTopColor: color.ink,
                  }}
                >
                  <Type
                    role="micro"
                    color={selected ? onAccent(accentName) : color.ink}
                    numberOfLines={1}
                  >
                    {item.product.name}
                  </Type>
                  <Type
                    role="micro"
                    color={selected ? onAccent(accentName) : color.inkSoft}
                    style={{ opacity: 0.8 }}
                  >
                    {formatPrice(item.product)}
                  </Type>
                </View>
              </Tap>
            </Shadowed>
          );
        })}
      </ScrollView>
    </View>
  );
}
