import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { border, color, motion, radius, space } from '@/theme/tokens';
import type { DeckCard, SkinProfile, SwipeDirection } from '@/types';
import { ProductCard } from './ProductCard';
import { Type } from './Type';

const { width: SCREEN_W } = Dimensions.get('window');

/** Distance past which a release commits rather than springs home. */
const COMMIT_DISTANCE = SCREEN_W * 0.28;
/** A fast flick commits even when it never travelled the full distance. */
const COMMIT_VELOCITY = 850;
/** Where the decision stamp starts fading in. */
const STAMP_ONSET = 40;

type Props = {
  cards: DeckCard[];
  facePhotoUri?: string | null;
  profile?: SkinProfile | null;
  revealBrand?: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Called instead of onSwipe when a high-risk item is swiped right. */
  onConfirmNeeded: (card: DeckCard) => void;
  /** The shopper flipped the card to read the breakdown before deciding. */
  onInspect: () => void;
  /** They crossed the commit threshold and then retreated from it. */
  onHesitate: () => void;
};

/**
 * The swipe deck.
 *
 * Gesture-only by explicit product decision — there are no Yes/No buttons — so
 * the gesture has to be unmistakable. Three things carry that: the card tilts
 * about a pivot below the screen so it rotates like a held object rather than
 * spinning about its centre, a full-bleed stamp resolves the decision before
 * release, and haptics fire once at the commit threshold so the shopper feels
 * where the line is without looking for it.
 */
export function SwipeDeck({
  cards,
  facePhotoUri,
  profile = null,
  revealBrand = true,
  onSwipe,
  onConfirmNeeded,
  onInspect,
  onHesitate,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  /** 0 while the incoming card settles, 1 once it has landed. */
  const entry = useSharedValue(1);
  /** Latches so the threshold tick fires once per crossing, not every frame. */
  const armed = useSharedValue(false);

  const top = cards[0];
  const next = cards[1];
  const third = cards[2];

  /**
   * Commits a swipe once the card has flown off-screen.
   *
   * Order matters: the store update runs BEFORE the position reset, so the next
   * card is already the top card by the time x returns to zero. Resetting first
   * would show the outgoing card snapped back to centre for a frame.
   */
  const settle = useCallback(
    (direction: SwipeDirection) => {
      void Haptics.notificationAsync(
        direction === 'right'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      onSwipe(direction);
      setFlipped(false);
      x.value = 0;
      y.value = 0;
      armed.value = false;

      // The next card arrives slightly small and off-axis, then springs square.
      // DESIGN.md calls for this: without it the replacement simply blinks into
      // existence and the stack stops reading as physical.
      entry.value = 0;
      entry.value = withSpring(1, motion.spring);
    },
    [onSwipe, x, y, armed],
  );

  /**
   * A high-risk right-swipe never leaves the deck.
   *
   * The card springs back and raises the confirm sheet instead of flying off
   * and teleporting home, so the interruption reads as the card refusing to go
   * rather than as a glitch.
   */
  const bounceBack = useCallback(
    (card: DeckCard) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      x.value = withSpring(0, motion.spring);
      y.value = withSpring(0, motion.spring);
      armed.value = false;
      onConfirmNeeded(card);
    },
    [onConfirmNeeded, x, y, armed],
  );

  const tick = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  // Read on the JS thread and captured by the worklet — a gesture callback
  // cannot reach into `cards` safely.
  const topCard = top!;
  const needsConfirm = top?.regret.band === 'high';

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;

      const past = Math.abs(e.translationX) > COMMIT_DISTANCE;
      if (past && !armed.value) {
        armed.value = true;
        runOnJS(tick)();
      } else if (!past && armed.value) {
        // Crossed the line and came back. This is the hesitation the brand
        // console reports, and it is only observable here in the gesture.
        armed.value = false;
        runOnJS(onHesitate)();
      }
    })
    .onEnd((e) => {
      const commit =
        Math.abs(e.translationX) > COMMIT_DISTANCE || Math.abs(e.velocityX) > COMMIT_VELOCITY;

      if (!commit) {
        x.value = withSpring(0, motion.spring);
        y.value = withSpring(0, motion.spring);
        armed.value = false;
        return;
      }

      const direction: SwipeDirection = e.translationX > 0 ? 'right' : 'left';

      // Intercepted before the fling, not after: a high-risk item must never
      // leave the deck and then reappear.
      if (direction === 'right' && needsConfirm) {
        runOnJS(bounceBack)(topCard);
        return;
      }

      // Fling along the release vector so the card leaves the way it was thrown.
      x.value = withTiming(
        Math.sign(e.translationX) * SCREEN_W * 1.6,
        { duration: 210 },
        (finished) => {
          if (finished) runOnJS(settle)(direction);
        },
      );
      y.value = withTiming(e.translationY + e.velocityY * 0.08, { duration: 210 });
    });

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(setFlipped)(!flipped);
      // Only opening counts as an inspection; closing it again does not.
      if (!flipped) runOnJS(onInspect)();
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: 0.92 + entry.value * 0.08 },
      // Rotating about a pivot below the card makes it swing like something held
      // at the bottom edge, instead of pinwheeling around its own middle.
      {
        rotate: `${interpolate(
          x.value,
          [-SCREEN_W, 0, SCREEN_W],
          [-12, 0, 12],
          Extrapolation.CLAMP,
        )}deg`,
      },
      // Entry tilt is folded in after the drag rotation so the two compose
      // rather than fight when a card is thrown before it has finished landing.
      { rotate: `${(1 - entry.value) * -3}deg` },
    ],
  }));

  const wantStamp = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [STAMP_ONSET, COMMIT_DISTANCE], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(x.value, [STAMP_ONSET, COMMIT_DISTANCE], [0.7, 1], Extrapolation.CLAMP),
      },
      { rotate: '-11deg' },
    ],
  }));

  const nopeStamp = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-COMMIT_DISTANCE, -STAMP_ONSET], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          x.value,
          [-COMMIT_DISTANCE, -STAMP_ONSET],
          [1, 0.7],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: '11deg' },
    ],
  }));

  // The card beneath rises as the top one leaves, so the stack feels physical.
  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(x.value),
      [0, COMMIT_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: 0.94 + progress * 0.06 }, { translateY: 16 - progress * 16 }],
      opacity: 0.6 + progress * 0.4,
    };
  });

  if (!top) return null;

  return (
    <View style={{ flex: 1 }}>
      {third && (
        <View style={[stackStyle, { transform: [{ scale: 0.88 }, { translateY: 32 }], opacity: 0.35 }]}>
          <CardShell />
        </View>
      )}

      {next && (
        <Animated.View style={[stackStyle, nextStyle]}>
          <ProductCard card={next} facePhotoUri={facePhotoUri} revealBrand={revealBrand} />
        </Animated.View>
      )}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[stackStyle, topStyle]}>
          <ProductCard
            card={top}
            facePhotoUri={facePhotoUri}
            profile={profile}
            revealBrand={revealBrand}
            flipped={flipped}
          />

          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 96, left: space.lg }, wantStamp]}
          >
            <Stamp label="Want" tone={color.violet} labelColor={color.paper} />
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 96, right: space.lg }, nopeStamp]}
          >
            <Stamp label="Nope" tone={color.tomato} labelColor={color.paper} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const stackStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function Stamp({ label, tone, labelColor }: { label: string; tone: string; labelColor: string }) {
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        backgroundColor: tone,
        borderWidth: border.bold,
        borderColor: color.ink,
        borderRadius: radius.md,
      }}
    >
      <Type role="display" color={labelColor}>
        {label}
      </Type>
    </View>
  );
}

/** Blank card body for the third position — it is only ever seen as an edge. */
function CardShell() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.groundSunk,
        borderWidth: border.bold,
        borderColor: color.ink,
        borderRadius: radius.lg,
      }}
    />
  );
}
