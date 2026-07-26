import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DEMO_MODELS, resolveDemoPerson } from '@/data/demoModels';
import { useAppStore } from '@/store/useAppStore';
import { border, color, radius, space } from '@/theme/tokens';
import { Cursor, IconCamera, IconImage, Starburst } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Shadowed } from '@/ui/Shadowed';
import { Tap } from '@/ui/Tap';
import { Type } from '@/ui/Type';

type Step = 'face' | 'body';

/**
 * Two-shot capture.
 *
 * Skin analysis needs the face at 60–80% of frame width and near-frontal; the
 * try-on needs a whole standing person filling ~80% of frame. Those are
 * genuinely incompatible framings, so collapsing them into one photo would
 * quietly degrade both. Asking for two shots is honest about that, and the
 * guide frame in the camera makes each one's requirement visible instead of
 * leaving the shopper to fail and be told afterwards.
 */
export default function Capture() {
  const router = useRouter();
  const setPerson = useAppStore((s) => s.setPerson);

  const [step, setStep] = useState<Step>('face');
  const [face, setFace] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const commit = (uri: string) => {
    if (step === 'face') {
      setFace(uri);
      setStep('body');
    } else {
      setBody(uri);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) commit(result.assets[0].uri);
  };

  const useDemoModel = async (id: string) => {
    const person = await resolveDemoPerson(id);
    if (!person) return;
    setPerson(person);
    router.push('/onboarding/scanning');
  };

  const proceed = () => {
    if (!face || !body) return;
    setPerson({
      key: body,
      face: { kind: 'file', uri: face },
      body: { kind: 'file', uri: body },
      faceDisplayUri: face,
      bodyDisplayUri: body,
      demoModelId: null,
    });
    router.push('/onboarding/scanning');
  };

  if (cameraOpen) {
    return (
      <CameraCapture
        step={step}
        onCancel={() => setCameraOpen(false)}
        onCaptured={(uri) => {
          setCameraOpen(false);
          commit(uri);
        }}
      />
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
        <View style={{ flexDirection: 'row', gap: space.xs, paddingTop: space.sm }}>
          <StepChip index="01" label="Face" active={step === 'face'} done={!!face} />
          <StepChip index="02" label="Body" active={step === 'body'} done={!!body} />
        </View>

        <View style={{ marginTop: space.lg, gap: space.xs }}>
          <Type role="display">{step === 'face' ? 'Your face' : 'Head to knee'}</Type>
          <Type role="body">
            {step === 'face'
              ? 'Look straight at the lens and fill the frame. Tilt your chin down and the scan will reject it.'
              : 'Stand square on, arms loose at your sides. This is the body the clothes get rendered onto.'}
          </Type>
        </View>

        <View style={{ marginTop: space.lg, flexDirection: 'row', gap: space.sm }}>
          <Shadowed radius={radius.pill} style={{ flex: 1 }}>
            <ActionTile label="Camera" onPress={() => setCameraOpen(true)} icon={<IconCamera size={22} />} />
          </Shadowed>
          <Shadowed radius={radius.pill} style={{ flex: 1 }}>
            <ActionTile label="Library" onPress={pickFromLibrary} icon={<IconImage size={22} />} tone={color.ground} />
          </Shadowed>
        </View>

        {(face || body) && (
          <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: space.lg, flexDirection: 'row', gap: space.sm }}>
            {face && <Thumb uri={face} label="Face" onClear={() => { setFace(null); setStep('face'); }} />}
            {body && <Thumb uri={body} label="Body" onClear={() => { setBody(null); setStep('body'); }} />}
          </Animated.View>
        )}

        {face && body && (
          <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: space.lg }}>
            <PillButton label="Scan my skin" onPress={proceed} tone={color.violet} fullWidth />
          </Animated.View>
        )}

        {/* Emulator escape hatch — and the fastest way to see the sort work. */}
        <View style={{ marginTop: space.xxl, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Cursor size={26} rotate={128} />
            <Type role="label">No camera? Borrow a body</Type>
          </View>
          <Type role="body">
            Three people across the tone range. Each one produces a genuinely
            different deck from the same catalogue — which is the whole point.
          </Type>

          <View style={{ gap: space.sm, marginTop: space.xs }}>
            {DEMO_MODELS.map((model, i) => (
              <Shadowed key={model.id} radius={radius.lg}>
                <Tap
                  feel="travel"
                  accessibilityRole="button"
                  accessibilityLabel={`Use demo model ${model.label}`}
                  onPress={() => void useDemoModel(model.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    padding: space.sm,
                    backgroundColor: color.paper,
                    borderWidth: border.bold,
                    borderColor: color.ink,
                    borderRadius: radius.lg,
                  }}
                >
                  <Image
                    source={model.faceAsset}
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: radius.md,
                      borderWidth: border.hair,
                      borderColor: color.ink,
                    }}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Type role="heading">{model.label}</Type>
                    <Type role="micro" color={color.inkSoft} style={{ opacity: 0.7 }} numberOfLines={1}>
                      {model.credit}
                    </Type>
                  </View>
                  {i === 1 && <Starburst size={30} fill={color.acid} rotate={14} />}
                </Tap>
              </Shadowed>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------------- */

function StepChip({ index, label, active, done }: { index: string; label: string; active: boolean; done: boolean }) {
  const tone = done ? color.forest : active ? color.violet : color.groundSunk;
  const fg = done || active ? color.paper : color.ink;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        backgroundColor: tone,
        borderWidth: border.hair,
        borderColor: color.ink,
        borderRadius: radius.pill,
      }}
    >
      <Type role="micro" color={fg} style={{ opacity: 0.7 }}>
        {index}
      </Type>
      <Type role="label" color={fg}>
        {done ? `${label} ✓` : label}
      </Type>
    </View>
  );
}

function ActionTile({
  label,
  onPress,
  icon,
  tone = color.acid,
}: {
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        backgroundColor: tone,
        borderWidth: border.hair,
        borderColor: color.ink,
        borderRadius: radius.pill,
      }}
    >
      {icon}
      <Type role="heading">{label}</Type>
    </Tap>
  );
}

function Thumb({ uri, label, onClear }: { uri: string; label: string; onClear: () => void }) {
  return (
    <Shadowed radius={radius.md} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: color.paper,
          borderWidth: border.bold,
          borderColor: color.ink,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        <Image source={{ uri }} style={{ width: '100%', height: 168 }} contentFit="cover" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.xs }}>
          <Type role="label">{label}</Type>
          <Tap onPress={onClear} accessibilityRole="button" accessibilityLabel={`Retake ${label}`} hitSlop={12}>
            <PillTag label="Retake" tone={color.groundSunk} />
          </Tap>
        </View>
      </View>
    </Shadowed>
  );
}

/* ---------------------------------------------------------------------- */

/**
 * Camera with a framing guide.
 *
 * The guide is not decoration: the API rejects photos on face size and head
 * angle, so showing the target frame up front converts a post-hoc error into a
 * thing the shopper can simply line up against.
 */
function CameraCapture({
  step,
  onCaptured,
  onCancel,
}: {
  step: Step;
  onCaptured: (uri: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(step === 'face' ? 'front' : 'back');
  const [busy, setBusy] = useState(false);
  const ref = useRef<CameraView>(null);

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Type role="display">Camera off</Type>
          <Type role="body">
            FITCHECK needs the camera to photograph you. Nothing is stored anywhere
            but on this device and the render API.
          </Type>
          <PillButton label="Allow camera" onPress={() => void requestPermission()} tone={color.violet} fullWidth />
          <PillButton label="Back" onPress={onCancel} variant="outline" fullWidth />
        </View>
      </Screen>
    );
  }

  const take = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await ref.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) onCaptured(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <CameraView ref={ref} style={{ flex: 1 }} facing={facing} />

      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: step === 'face' ? '72%' : '64%',
            height: step === 'face' ? '42%' : '76%',
            borderWidth: border.bold,
            borderColor: color.acid,
            borderRadius: step === 'face' ? radius.xl : radius.lg,
            borderStyle: 'dashed',
          }}
        />
      </View>

      <View style={{ position: 'absolute', top: space.xxl, left: space.lg, right: space.lg, alignItems: 'center' }}>
        <PillTag
          label={step === 'face' ? 'Fill the frame · look straight on' : 'Whole body · stand square'}
          tone={color.acid}
          shadowed
        />
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: space.xxl,
          left: space.lg,
          right: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.sm,
        }}
      >
        <PillButton label="Cancel" onPress={onCancel} variant="outline" size="md" />
        <PillButton label={busy ? 'Hold still' : 'Take it'} onPress={() => void take()} tone={color.violet} disabled={busy} />
        <PillButton
          label="Flip"
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          variant="outline"
          size="md"
        />
      </View>
    </View>
  );
}
