import { Asset } from 'expo-asset';

import type { PersonPhotos } from '@/store/useAppStore';
import type { DemoModel } from '@/types';

/**
 * Bundled stand-ins for the camera.
 *
 * These are a functional requirement rather than a convenience: the Android
 * emulator's camera produces a synthetic test scene with no human in it, so
 * without these there is no way to exercise the real pipeline off a physical
 * device. They are also how the skin-informed sort gets demonstrated — three
 * people spanning the tone range produce three visibly different decks.
 *
 * The labels are the undertone/depth the API ACTUALLY measured for each photo,
 * not the tone they were picked for. Model A was sourced as "fair/cool" but her
 * red hair pulls the reading warm, and labelling her cool would have put a claim
 * on screen that the next screen immediately contradicts.
 */
export const DEMO_MODELS: (DemoModel & {
  facePublicUrl: string;
  bodyPublicUrl: string;
  recordedSkinHex: string;
})[] = [
  {
    id: 'model-a',
    label: 'Light / Neutral',
    faceAsset: require('../../assets/demo-models/model-a-face.jpg'),
    bodyAsset: require('../../assets/demo-models/model-a-body.jpg'),
    facePublicUrl: 'https://images.pexels.com/photos/6668809/pexels-photo-6668809.jpeg?auto=compress&w=1200',
    bodyPublicUrl: 'https://images.pexels.com/photos/6668809/pexels-photo-6668809.jpeg?auto=compress&w=1200',
    credit: 'Photo by Nataliya Vaitkevich on Pexels',
    // Recorded from a real skin-tone-analysis run on this exact file
    // (L* 66.8). Used only when the live call cannot run.
    recordedSkinHex: '#bd9c86',
  },
  {
    id: 'model-b',
    label: 'Medium / Warm',
    faceAsset: require('../../assets/demo-models/model-b-face.jpg'),
    bodyAsset: require('../../assets/demo-models/model-b-body.jpg'),
    facePublicUrl: 'https://images.pexels.com/photos/33055634/pexels-photo-33055634.jpeg?auto=compress&w=1200',
    bodyPublicUrl: 'https://images.pexels.com/photos/33055634/pexels-photo-33055634.jpeg?auto=compress&w=1200',
    credit: 'Photo by Youssef Mahmoud on Pexels',
    // Recorded from a real skin-tone-analysis run on this exact file
    // (L* 47.2). Used only when the live call cannot run.
    recordedSkinHex: '#8e684c',
  },
  {
    id: 'model-c',
    label: 'Deep / Neutral',
    faceAsset: require('../../assets/demo-models/model-c-face.jpg'),
    bodyAsset: require('../../assets/demo-models/model-c-body.jpg'),
    facePublicUrl: 'https://images.pexels.com/photos/19317142/pexels-photo-19317142.jpeg?auto=compress&w=1200',
    bodyPublicUrl: 'https://images.pexels.com/photos/19317142/pexels-photo-19317142.jpeg?auto=compress&w=1200',
    credit: 'Photo by Waldir Évora on Pexels',
    // Recorded from a real skin-tone-analysis run on this exact file
    // (L* 33.1). Used only when the live call cannot run.
    recordedSkinHex: '#644835',
  },
];

export const findDemoModel = (id: string) => DEMO_MODELS.find((m) => m.id === id) ?? null;

/**
 * Resolves a demo model into the two photo sources the API needs.
 *
 * The face and body take deliberately different routes, and the reason is a bug
 * that only showed up against the live API: for two of the three models the
 * public "face" URL is actually the full-body frame the crop was cut from, and
 * skin analysis rejects it with `error_no_face` because the face occupies far
 * too little of it. So the face always comes from the bundled crop, uploaded,
 * while the body uses its public URL — which skips the upload round-trip and is
 * verified working for try-on.
 */
export async function resolveDemoPerson(id: string): Promise<PersonPhotos | null> {
  const model = findDemoModel(id);
  if (!model) return null;

  const [faceAsset] = await Asset.loadAsync(model.faceAsset);
  const faceUri = faceAsset?.localUri ?? faceAsset?.uri;
  if (!faceUri) return null;

  return {
    key: model.id,
    face: { kind: 'file', uri: faceUri },
    body: { kind: 'url', url: model.bodyPublicUrl },
    faceDisplayUri: faceUri,
    bodyDisplayUri: model.bodyPublicUrl,
    demoModelId: model.id,
  };
}
