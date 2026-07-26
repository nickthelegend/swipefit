import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Chevrons, Cursor, Eyes, Squiggle, Starburst } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Type } from '@/ui/Type';
import { color, motion, space } from '@/theme/tokens';

/**
 * The thesis viewport.
 *
 * The headline is the product's whole argument, set at the scale the argument
 * deserves, with the doodles interlocking into the type rather than sitting
 * beside it in an illustration slot. Nothing here is a hero image with a caption.
 */
export default function Welcome() {
  const router = useRouter();

  const lift = useSharedValue(28);
  const spin = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(0, motion.springLoose);
    // One authored motion moment: the spark turns in slowly, once, and stops.
    spin.value = withDelay(240, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [lift, spin]);

  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 140 - 140}deg` }, { scale: 0.6 + spin.value * 0.4 }],
    opacity: spin.value,
  }));

  return (
    <Screen grid>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Type role="label">Fitcheck</Type>
          <PillTag label="YouCam Skin AI + Apparel VTO" tone={color.acid} />
        </View>

        <Animated.View style={[{ gap: space.xxs }, liftStyle]}>
          {/* Line 1 — spark sits in the gap the short word leaves. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Type role="mega">The</Type>
            <Animated.View style={spinStyle}>
              <Starburst size={70} stroke={color.ink} fill={color.tomato} />
            </Animated.View>
          </View>

          {/* Line 2 — the eyes plate is the subject of the sentence. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Type role="mega">Face</Type>
            <Animated.View entering={FadeIn.delay(420).duration(320)}>
              <Eyes size={124} fill={color.paper} rotate={-4} />
            </Animated.View>
          </View>

          <View style={{ marginLeft: -2 }}>
            <Type role="mega" color={color.violet}>
              Decides
            </Type>
            <View style={{ marginTop: -8, marginLeft: 4 }}>
              <Squiggle size={272} stroke={color.tomato} rotate={-1} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Animated.View entering={FadeIn.delay(560).duration(320)}>
              <Chevrons size={74} fill={color.forest} />
            </Animated.View>
            <Type role="mega">What</Type>
          </View>

          <Type role="mega">You Wear</Type>
        </Animated.View>

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
            <Type role="body" style={{ flex: 1 }}>
              One skin scan decides which clothes you see. Then every card is that
              garment rendered on your actual body — not a model's.
            </Type>
            <Animated.View entering={FadeIn.delay(700).duration(320)} style={{ marginBottom: space.xxs }}>
              <Cursor size={44} fill={color.acid} rotate={155} />
            </Animated.View>
          </View>

          <PillButton
            label="Start the scan"
            onPress={() => router.push('/onboarding/capture')}
            tone={color.violet}
            fullWidth
          />
        </View>
      </View>
    </Screen>
  );
}
