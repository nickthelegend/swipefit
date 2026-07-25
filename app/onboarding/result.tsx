import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { seasonLabel, seasonSignature } from '@/logic/matching';
import { useAppStore } from '@/store/useAppStore';
import { border, color, radius, space } from '@/theme/tokens';
import { Blob, Chevrons } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Type } from '@/ui/Type';

/**
 * The scan reveal.
 *
 * Leads with the undertone because that is the value the rest of the product is
 * built on, and shows the measured hexes as real swatches so the reading is
 * inspectable rather than asserted. The confidence figure is shown even when it
 * is low — a hedged number the shopper can see beats a confident one they
 * cannot check.
 */
export default function ScanResult() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const deckSize = useAppStore((s) => s.deck.length);

  if (!profile) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Type role="display">No scan yet</Type>
          <PillButton label="Take the photos" onPress={() => router.replace('/onboarding/capture')} tone={color.violet} fullWidth />
        </View>
      </Screen>
    );
  }

  const toneColor =
    profile.undertone === 'warm' ? color.tomato : profile.undertone === 'cool' ? color.violet : color.forest;

  return (
    <Screen grid>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
        <View style={{ paddingTop: space.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Type role="label">Your reading</Type>
          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
            {profile.readingSource === 'recorded' && (
              <PillTag label="Recorded" tone={color.acid} />
            )}
            <PillTag label={`Confidence ${Math.round(profile.confidence * 100)}%`} tone={color.groundSunk} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(320)} style={{ marginTop: space.lg }}>
          <Type role="mega" color={toneColor}>
            {profile.undertone}
          </Type>
          <Type role="mega">{profile.depth}</Type>
        </Animated.View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
          <Chevrons size={44} fill={toneColor} />
          <Type role="body" style={{ flex: 1 }}>
            {seasonLabel(profile.season)} — your palette leans {seasonSignature(profile.season)}.
          </Type>
        </View>

        {/* Measured values, shown as swatches so the reading can be checked. */}
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ marginTop: space.lg }}>
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
              <Type role="label">
                {profile.readingSource === 'recorded' ? 'Recorded from YouCam' : 'Measured by YouCam'}
              </Type>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Swatch hex={profile.skinHex} label="Skin" />
                {profile.hairHex && (
                  <Swatch
                    hex={profile.hairHex}
                    label={
                      profile.hairColorName && profile.hairColorName.toLowerCase() !== 'other'
                        ? profile.hairColorName
                        : 'Hair'
                    }
                  />
                )}
                {profile.eyeHex && (
                  <Swatch
                    hex={profile.eyeHex}
                    label={
                      profile.eyeColorName && profile.eyeColorName.toLowerCase() !== 'other'
                        ? profile.eyeColorName
                        : 'Eyes'
                    }
                  />
                )}
                {profile.lipHex && <Swatch hex={profile.lipHex} label="Lips" />}
              </View>
              <Type role="micro" color={color.inkSoft} style={{ opacity: 0.7 }}>
                {profile.readingSource === 'recorded'
                  ? 'A real YouCam reading of this exact photo, taken earlier and shipped with the app because the API key is out of credits. Undertone, depth and season are derived from it in CIELAB.'
                  : 'The API returns colour only. Undertone, depth and season are derived from these in CIELAB.'}
              </Type>
            </View>
          </Shadowed>
        </Animated.View>

        {profile.concerns.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(320)} style={{ marginTop: space.md }}>
            <Shadowed radius={radius.lg}>
              <View
                style={{
                  backgroundColor: color.acid,
                  borderWidth: border.bold,
                  borderColor: color.ink,
                  borderRadius: radius.lg,
                  padding: space.md,
                  gap: space.sm,
                }}
              >
                <Type role="label">Skin condition</Type>
                {profile.concerns.map((c) => (
                  <View key={c.type} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Type role="bodyStrong">{c.label}</Type>
                      <Type role="bodyStrong">{Math.round(c.rawScore)}</Type>
                    </View>
                    <View style={{ height: 10, borderWidth: border.hair, borderColor: color.ink, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: color.ground }}>
                      <View style={{ width: `${Math.max(2, Math.min(100, c.rawScore))}%`, height: '100%', backgroundColor: color.ink }} />
                    </View>
                  </View>
                ))}
                <Type role="micro" style={{ opacity: 0.7 }}>
                  Higher is healthier. Raw scores, not the API's inflated display scores.
                </Type>
              </View>
            </Shadowed>
          </Animated.View>
        )}

        <View style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Blob size={58} fill={toneColor} rotate={-10} />
          <Type role="body" style={{ flex: 1 }}>
            {deckSize} pieces just re-sorted around that reading.
          </Type>
        </View>

        <View style={{ marginTop: space.lg }}>
          <PillButton
            label="Build my deck"
            onPress={() => router.replace('/onboarding/preparing')}
            tone={color.violet}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.xxs, flex: 1 }}>
      <View
        style={{
          width: '100%',
          height: 54,
          backgroundColor: hex,
          borderWidth: border.bold,
          borderColor: color.ink,
          borderRadius: radius.sm,
        }}
      />
      <Type role="micro" numberOfLines={1}>
        {label}
      </Type>
      <Type role="micro" color={color.inkSoft} style={{ opacity: 0.6 }}>
        {hex.toUpperCase()}
      </Type>
    </View>
  );
}
