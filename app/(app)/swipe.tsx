import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import type { Undertone } from '@/logic/color';
import { seasonLabel } from '@/logic/matching';
import { useAppStore } from '@/store/useAppStore';
import { border, color, radius, space } from '@/theme/tokens';
import { CoachOverlay } from '@/ui/CoachOverlay';
import { IconUndo, Starburst } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { SwipeDeck } from '@/ui/SwipeDeck';
import { Type } from '@/ui/Type';
import type { DeckCard } from '@/types';

export default function SwipeScreen() {
  const router = useRouter();

  const deck = useAppStore((s) => s.deck);
  const cursor = useAppStore((s) => s.cursor);
  const profile = useAppStore((s) => s.profile);
  const person = useAppStore((s) => s.person);
  const mode = useAppStore((s) => s.mode);
  const coachSeen = useAppStore((s) => s.coachSeen);
  const simulated = useAppStore((s) => s.simulatedUndertone);

  const swipe = useAppStore((s) => s.swipe);
  const undoSwipe = useAppStore((s) => s.undoSwipe);
  const setMode = useAppStore((s) => s.setMode);
  const markCoachSeen = useAppStore((s) => s.markCoachSeen);
  const ensureRendersAhead = useAppStore((s) => s.ensureRendersAhead);
  const noteInspected = useAppStore((s) => s.noteInspected);
  const noteHesitated = useAppStore((s) => s.noteHesitated);
  const noteConfirmPrompted = useAppStore((s) => s.noteConfirmPrompted);
  const setSimulatedUndertone = useAppStore((s) => s.setSimulatedUndertone);
  const resetAll = useAppStore((s) => s.resetAll);

  const [confirming, setConfirming] = useState<DeckCard | null>(null);
  const [showSim, setShowSim] = useState(false);

  const remaining = deck.slice(cursor);

  useEffect(() => {
    ensureRendersAhead();
  }, [cursor, ensureRendersAhead, deck.length]);

  if (!profile) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Type role="display">No scan yet</Type>
          <PillButton label="Start the scan" onPress={() => router.replace('/onboarding')} tone={color.violet} fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={{ top: true, bottom: false }} padded={false} style={{ paddingHorizontal: space.md }}>
      {/* Header carries the causal link: this reading produced this deck. */}
      <View style={{ paddingTop: space.xs, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setShowSim((v) => !v)} accessibilityRole="button" accessibilityLabel="Change simulated undertone" hitSlop={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: profile.skinHex,
                  borderWidth: border.hair,
                  borderColor: color.ink,
                }}
              />
              <Type role="label">
                {profile.undertone} · {seasonLabel(profile.season)}
              </Type>
              {simulated && <PillTag label="Sim" tone={color.acid} />}
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
            <Pressable
              onPress={undoSwipe}
              disabled={cursor === 0}
              accessibilityRole="button"
              accessibilityLabel="Undo last swipe"
              hitSlop={10}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: border.hair,
                borderColor: color.ink,
                borderRadius: radius.pill,
                backgroundColor: color.ground,
                opacity: cursor === 0 ? 0.35 : 1,
              }}
            >
              <IconUndo size={19} />
            </Pressable>
            <ModeToggle mode={mode} onChange={setMode} />
          </View>
        </View>

        {showSim && (
          <Animated.View entering={FadeIn.duration(180)}>
            <UndertoneSimulator
              value={simulated}
              onChange={setSimulatedUndertone}
              onStartOver={() => {
                resetAll();
                router.replace('/onboarding');
              }}
            />
          </Animated.View>
        )}
      </View>

      <View style={{ flex: 1, marginTop: space.sm, marginBottom: space.sm }}>
        {remaining.length > 0 ? (
          <SwipeDeck
            cards={remaining}
            facePhotoUri={person?.faceDisplayUri ?? null}
            profile={profile}
            onSwipe={swipe}
            onConfirmNeeded={(card) => {
              noteConfirmPrompted();
              setConfirming(card);
            }}
            onInspect={noteInspected}
            onHesitate={noteHesitated}
          />
        ) : (
          <DeckEmpty onOpenBag={() => router.push('/(app)/bag')} />
        )}
      </View>

      {!coachSeen && remaining.length > 0 && <CoachOverlay onDismiss={markCoachSeen} />}

      {confirming && (
        <RegretSheet
          card={confirming}
          onKeep={() => {
            setConfirming(null);
            swipe('right');
          }}
          onSkip={() => {
            setConfirming(null);
            swipe('left');
          }}
        />
      )}
    </Screen>
  );
}

/* ---------------------------------------------------------------------- */

function ModeToggle({ mode, onChange }: { mode: 'apparel' | 'beauty'; onChange: (m: 'apparel' | 'beauty') => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: border.hair,
        borderColor: color.ink,
        borderRadius: radius.pill,
        overflow: 'hidden',
        height: 44,
      }}
    >
      {(['apparel', 'beauty'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === m }}
          style={{
            paddingHorizontal: space.sm,
            justifyContent: 'center',
            backgroundColor: mode === m ? color.ink : 'transparent',
          }}
        >
          <Type role="micro" color={mode === m ? color.ground : color.ink}>
            {m === 'apparel' ? 'Fit' : 'Face'}
          </Type>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Live undertone override.
 *
 * The product claims the same catalogue re-sorts around the scan. This lets that
 * be shown in three seconds instead of described — and without spending another
 * 20 units on a second tone scan. Labelled as simulated wherever it is active.
 */
function UndertoneSimulator({
  value,
  onChange,
  onStartOver,
}: {
  value: Undertone | null;
  onChange: (u: Undertone | null) => void;
  onStartOver: () => void;
}) {
  const options: { key: Undertone | null; label: string; tone: string }[] = [
    { key: null, label: 'Measured', tone: color.groundSunk },
    { key: 'warm', label: 'Warm', tone: color.tomato },
    { key: 'neutral', label: 'Neutral', tone: color.forest },
    { key: 'cool', label: 'Cool', tone: color.violet },
  ];

  return (
    <Shadowed radius={radius.lg} offset={{ x: 3, y: 4 }}>
      <View
        style={{
          backgroundColor: color.paper,
          borderWidth: border.bold,
          borderColor: color.ink,
          borderRadius: radius.lg,
          padding: space.sm,
          gap: space.xs,
        }}
      >
        <Type role="micro" color={color.inkSoft}>
          Force an undertone · re-sorts the same catalogue live
        </Type>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {options.map((o) => {
            const active = value === o.key;
            return (
              <Pressable
                key={o.label}
                onPress={() => onChange(o.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  minHeight: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? o.tone : color.ground,
                  borderWidth: border.hair,
                  borderColor: color.ink,
                  borderRadius: radius.pill,
                }}
              >
                <Type role="micro" color={active && o.key !== null ? color.paper : color.ink}>
                  {o.label}
                </Type>
              </Pressable>
            );
          })}
        </View>

        {/* Swapping demo person without clearing app data. Also drops the render
            cache, so the next person cannot inherit this one's images. */}
        <Pressable
          onPress={onStartOver}
          accessibilityRole="button"
          accessibilityLabel="Start over with a different person"
          style={{
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: border.hair,
            borderColor: color.ink,
            borderRadius: radius.pill,
            backgroundColor: color.groundSunk,
          }}
        >
          <Type role="micro">Start over · new person</Type>
        </Pressable>
      </View>
    </Shadowed>
  );
}

/** Only high-risk right-swipes interrupt; everything else stays in the flow. */
function RegretSheet({
  card,
  onKeep,
  onSkip,
}: {
  card: DeckCard;
  onKeep: () => void;
  onSkip: () => void;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
      }}
    >
      <Animated.View entering={SlideInDown.duration(240)}>
        <View
          style={{
            backgroundColor: color.ground,
            borderTopWidth: border.bold,
            borderTopColor: color.ink,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space.lg,
            gap: space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Starburst size={44} fill={color.tomato} rotate={-12} />
            <Type role="title" style={{ flex: 1 }}>
              Before you add it
            </Type>
          </View>

          <Type role="body">{card.regret.reason}</Type>

          <View
            style={{
              padding: space.sm,
              backgroundColor: color.groundSunk,
              borderWidth: border.hair,
              borderColor: color.ink,
              borderRadius: radius.md,
            }}
          >
            <Type role="micro" color={color.inkSoft}>
              {card.regret.risk}% is an illustrative heuristic from category, cut,
              size run and colour fit — not measured return data.
            </Type>
          </View>

          <View style={{ gap: space.sm }}>
            <PillButton label="Add it anyway" onPress={onKeep} tone={color.violet} fullWidth />
            <PillButton label="Skip it" onPress={onSkip} variant="outline" fullWidth />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function DeckEmpty({ onOpenBag }: { onOpenBag: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <Starburst size={92} fill={color.acid} rotate={-14} />
      <Type role="display" align="center">
        That's the rail
      </Type>
      <Type role="body" align="center" style={{ maxWidth: 280 }}>
        You've seen everything matched to your reading. What you kept is in the bag.
      </Type>
      <PillButton label="Open the bag" onPress={onOpenBag} tone={color.tomato} />
    </View>
  );
}
