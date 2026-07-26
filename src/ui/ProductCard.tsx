import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { brandAccent, formatPrice } from '@/data/catalog';
import { fitVerdict } from '@/logic/reasoning';
import { color, onAccent, border, radius, space } from '@/theme/tokens';
import type { DeckCard, SkinProfile } from '@/types';
import { Blob, Starburst } from './doodles';
import { PillTag } from './PillButton';
import { Sticker } from './Sticker';
import { Type } from './Type';

type Props = {
  card: DeckCard;
  /** The shopper's own face, used to composite beauty-mode shades. */
  facePhotoUri?: string | null;
  /** Drives the fit verdict on the reverse of the card. */
  profile?: SkinProfile | null;
  /**
   * When false the brand is withheld until the shopper commits.
   *
   * Both the name AND the accent colour go, because the accent identifies the
   * brand just as reliably once you have seen the deck for a minute — hiding
   * only the name would leak the answer.
   */
  revealBrand?: boolean;
  flipped?: boolean;
  onFlip?: () => void;
};

const RISK_TONE = { high: color.tomato, medium: color.acid, low: color.forest } as const;

export function ProductCard({
  card,
  facePhotoUri,
  profile = null,
  revealBrand = true,
  flipped = false,
  onFlip,
}: Props) {
  const { product, match, regret, render } = card;
  const accent = revealBrand ? color[brandAccent(product.brand)] : color.ink;
  const accentText = revealBrand ? onAccent(brandAccent(product.brand)) : color.ground;

  const flip = useSharedValue(flipped ? 1 : 0);
  useEffect(() => {
    flip.value = withTiming(flipped ? 1 : 0, { duration: 320 });
  }, [flipped, flip]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));

  // When the deck owns the tap (so it can race it against the pan gesture) no
  // Pressable is rendered — a Pressable with no handler still swallows touches.
  const Wrapper = onFlip ? Pressable : View;

  return (
    <Wrapper
      {...(onFlip ? { onPress: onFlip, accessibilityRole: 'button' as const } : {})}
      accessibilityLabel={`${product.brand} ${product.name}, ${match.score} percent match. Double tap for the full breakdown.`}
      style={{ flex: 1 }}
    >
      <Animated.View style={[{ flex: 1, backfaceVisibility: 'hidden' }, frontStyle]}>
        <CardFace
          card={card}
          accent={accent}
          accentText={accentText}
          facePhotoUri={facePhotoUri}
          revealBrand={revealBrand}
        />
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
          backStyle,
        ]}
      >
        <CardBack
          card={card}
          accent={accent}
          accentText={accentText}
          profile={profile}
          revealBrand={revealBrand}
        />
      </Animated.View>
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------
 * Front
 * ---------------------------------------------------------------------- */

function CardFace({
  card,
  accent,
  accentText,
  facePhotoUri,
  revealBrand,
}: {
  card: DeckCard;
  accent: string;
  accentText: string;
  facePhotoUri?: string | null;
  revealBrand: boolean;
}) {
  const { product, match, regret, render } = card;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.paper,
        borderWidth: border.bold,
        borderColor: color.ink,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: 1 }}>
        <CardMedia render={render} product={product} facePhotoUri={facePhotoUri} />

        <Sticker
          kicker="Match"
          value={String(match.score)}
          tone={match.band === 'fights' ? color.tomato : color.acid}
          labelColor={match.band === 'fights' ? color.paper : color.ink}
          rotate={-6}
          style={{ position: 'absolute', top: space.md, left: space.md }}
        />

        {regret.band !== 'low' && (
          <Sticker
            kicker="Return risk"
            value={`${regret.risk}%`}
            tone={RISK_TONE[regret.band]}
            labelColor={regret.band === 'high' ? color.paper : color.ink}
            rotate={6}
            style={{ position: 'absolute', top: space.md, right: space.md }}
          />
        )}

        {match.band === 'hero' && (
          <View style={{ position: 'absolute', right: space.md, bottom: space.md }}>
            <Starburst size={54} stroke={color.ink} fill={color.acid} rotate={12} />
          </View>
        )}
      </View>

      {/* Colour-blocked footer strip: the card's identity, and the brand's. */}
      <View
        style={{
          backgroundColor: accent,
          borderTopWidth: border.bold,
          borderTopColor: color.ink,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: space.md,
          gap: space.xxs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Type role="micro" color={accentText} style={{ opacity: 0.8 }} numberOfLines={1}>
            {revealBrand ? product.brand : 'Brand hidden'}
          </Type>
          <PillTag label={formatPrice(product)} tone={color.ground} labelColor={color.ink} />
        </View>

        <Type role="title" color={accentText} numberOfLines={2}>
          {product.name}
        </Type>

        <Type role="body" color={accentText} numberOfLines={2} style={{ opacity: 0.92 }}>
          {match.reason}
        </Type>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------
 * Media
 * ---------------------------------------------------------------------- */

function CardMedia({
  render,
  product,
  facePhotoUri,
}: {
  render: DeckCard['render'];
  product: DeckCard['product'];
  facePhotoUri?: string | null;
}) {
  // Beauty mode composites locally rather than spending VTO units on an API
  // outside the judged track — see data/beauty.ts for the reasoning.
  if (product.mode === 'beauty') {
    return <BeautyMedia product={product} facePhotoUri={facePhotoUri} />;
  }

  if (render.status === 'ready') {
    return (
      <Image
        source={{ uri: render.uri }}
        style={{ flex: 1, backgroundColor: color.paper }}
        contentFit="cover"
        transition={180}
      />
    );
  }

  if (render.status === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: color.paper }}>
        <Image
          source={{ uri: product.productImageUrl }}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={180}
        />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: space.lg, alignItems: 'center' }}>
          <PillTag label="Try-on unavailable · showing the product" tone={color.ground} shadowed />
        </View>
      </View>
    );
  }

  return <RenderingMedia product={product} />;
}

/**
 * The waiting state.
 *
 * Shows the real garment immediately rather than a skeleton, because a shopper
 * looking at a spinner has nothing to decide on. The pulsing strip communicates
 * that a better image is coming without pretending the card is empty.
 */
function RenderingMedia({ product }: { product: DeckCard['product'] }) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 620 }), withTiming(0.35, { duration: 620 })),
      -1,
      false,
    );
  }, [pulse]);

  const barStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <Image
        source={{ uri: product.productImageUrl }}
        style={{ flex: 1, opacity: 0.82 }}
        contentFit="contain"
        transition={180}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: space.xs, paddingBottom: space.lg }}>
        <Animated.View
          style={[
            {
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              backgroundColor: color.violet,
              borderWidth: border.hair,
              borderColor: color.ink,
              borderRadius: radius.pill,
            },
            barStyle,
          ]}
        >
          <Type role="micro" color={color.paper}>
            Putting this on you
          </Type>
        </Animated.View>
      </View>
    </View>
  );
}

/** Foundation shade composited over the shopper's own face photo. */
function BeautyMedia({
  product,
  facePhotoUri,
}: {
  product: DeckCard['product'];
  facePhotoUri?: string | null;
}) {
  if (product.beautyKind === 'skincare') {
    return (
      <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
        <Blob size={130} fill={color.forest} rotate={-8} />
        <Type role="display" align="center" style={{ marginTop: space.lg }}>
          {product.colorName}
        </Type>
        <Type role="body" align="center" style={{ marginTop: space.xs }}>
          {product.fitNote}
        </Type>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      {facePhotoUri ? (
        <Image source={{ uri: facePhotoUri }} style={{ flex: 1 }} contentFit="cover" transition={180} />
      ) : (
        <View style={{ flex: 1, backgroundColor: product.colorHex }} />
      )}
      <View
        style={{
          position: 'absolute',
          left: space.md,
          bottom: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        }}
      >
        <View
          style={{
            width: 78,
            height: 78,
            backgroundColor: product.colorHex,
            borderWidth: border.bold,
            borderColor: color.ink,
            borderRadius: radius.md,
          }}
        />
        <PillTag label={`Shade ${product.colorName}`} tone={color.ground} shadowed />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------
 * Back
 * ---------------------------------------------------------------------- */

function CardBack({
  card,
  accent,
  accentText,
  profile,
  revealBrand,
}: {
  card: DeckCard;
  accent: string;
  accentText: string;
  profile: SkinProfile | null;
  revealBrand: boolean;
}) {
  const { product, match, regret } = card;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.ground,
        borderWidth: border.bold,
        borderColor: color.ink,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <View style={{ backgroundColor: accent, padding: space.md, borderBottomWidth: border.bold, borderBottomColor: color.ink }}>
        <Type role="micro" color={accentText} style={{ opacity: 0.8 }}>
          {revealBrand ? product.brand : 'Brand hidden'}
        </Type>
        <Type role="title" color={accentText} numberOfLines={2}>
          {product.name}
        </Type>
      </View>

      <View style={{ flex: 1, padding: space.md, gap: space.md }}>
        <Row label="Colour" value={`${product.colorName}`} swatch={product.colorHex} />
        <Row label="Sizes" value={product.sizeInfo} />
        <Row label="Cut" value={product.fitNote} />

        <View style={{ height: border.hair, backgroundColor: color.ink, opacity: 0.15 }} />

        <View style={{ gap: space.xxs }}>
          <Type role="label">Colour · {match.score}</Type>
          <Type role="body">{match.reason}</Type>
        </View>

        {/* Fit is its own verdict. Colour reasoning already owns the section
            above, so folding both into one line made neither of them land. */}
        {profile && (
          <View style={{ gap: space.xxs }}>
            <Type role="label">Fit</Type>
            <Type role="body">{fitVerdict(product, profile)}</Type>
          </View>
        )}

        <View style={{ gap: space.xxs }}>
          <Type role="label">Return risk {regret.risk}%</Type>
          <Type role="body">{regret.reason}</Type>
          {/* The honesty boundary, stated on the card rather than in a footnote. */}
          <Type role="micro" color={color.inkSoft} style={{ marginTop: space.xxs, opacity: 0.7 }}>
            Illustrative heuristic — not measured return data
          </Type>
        </View>
      </View>

      <View style={{ padding: space.md, paddingTop: 0 }}>
        <PillTag label="Tap to flip back" tone={color.groundSunk} />
      </View>
    </View>
  );
}

function Row({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Type role="label" style={{ width: 68 }}>
        {label}
      </Type>
      {swatch ? (
        <View
          style={{
            width: 22,
            height: 22,
            backgroundColor: swatch,
            borderWidth: border.hair,
            borderColor: color.ink,
            borderRadius: radius.sm,
          }}
        />
      ) : null}
      <Type role="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
        {value}
      </Type>
    </View>
  );
}
