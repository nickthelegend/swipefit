import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ALL_PRODUCTS } from '@/data/catalog';
import { findDemoModel } from '@/data/demoModels';
import { contrastLevel, undertoneFromSkinHex, type Undertone } from '@/logic/color';
import { buildDeck, deriveSeason } from '@/logic/matching';
import { assessRegret } from '@/logic/reasoning';
import { cacheRender, readCachedRender } from '@/services/renderCache';
import * as youcam from '@/services/youcam';
import type {
  CartItem,
  DeckCard,
  Mode,
  Product,
  RenderState,
  SkinConcern,
  SkinProfile,
  SwipeDirection,
  SwipeEvent,
} from '@/types';

/** Human labels for the concern codes the skin-analysis API returns. */
const CONCERN_LABELS: Record<string, string> = {
  wrinkle: 'Wrinkles',
  pore: 'Pores',
  texture: 'Texture',
  redness: 'Redness',
  acne: 'Blemishes',
  oiliness: 'Oiliness',
};

/** The two photos onboarding captures. They have different framing rules. */
export type PersonPhotos = {
  /** Stable identity for the render cache — a model id, or the body photo URI. */
  key: string;
  face: youcam.PhotoSource;
  body: youcam.PhotoSource;
  /** For display. Local URI or remote URL. */
  faceDisplayUri: string;
  bodyDisplayUri: string;
  demoModelId: string | null;
};

/**
 * How far ahead of the swipe cursor renders are kept.
 *
 * The product's second principle is that a card must never make the shopper
 * wait. A render measured ~8s, so keeping this many ready means a shopper would
 * have to swipe faster than one card every two seconds to catch up with it.
 */
const RENDER_LOOKAHEAD = 4;

/** Rendered eagerly behind the "preparing your looks" screen before the deck opens. */
const PREFETCH_COUNT = 6;

type State = {
  onboarded: boolean;
  coachSeen: boolean;
  person: PersonPhotos | null;
  profile: SkinProfile | null;
  /** Dev override that re-sorts the deck without spending a scan. */
  simulatedUndertone: Undertone | null;

  mode: Mode;
  deck: DeckCard[];
  cursor: number;
  swipes: SwipeEvent[];
  cart: CartItem[];

  prepareProgress: { done: number; total: number };
  lastError: string | null;
};

type Actions = {
  setPerson: (person: PersonPhotos) => void;
  runScan: () => Promise<void>;
  applyProfile: (profile: SkinProfile) => void;
  setSimulatedUndertone: (undertone: Undertone | null) => void;

  setMode: (mode: Mode) => void;
  rebuildDeck: () => void;
  prefetchDeck: () => Promise<void>;
  ensureRendersAhead: () => void;

  swipe: (direction: SwipeDirection) => void;
  undoSwipe: () => void;
  markCoachSeen: () => void;

  removeFromCart: (productId: string) => void;
  markSentToBrand: (productIds: string[]) => void;
  clearCart: () => void;

  resetAll: () => void;
};

/** Tracks in-flight renders so a re-render pass never double-charges a card. */
const inFlight = new Set<string>();

export const useAppStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      onboarded: false,
      coachSeen: false,
      person: null,
      profile: null,
      simulatedUndertone: null,
      mode: 'apparel',
      deck: [],
      cursor: 0,
      swipes: [],
      cart: [],
      prepareProgress: { done: 0, total: 0 },
      lastError: null,

      setPerson: (person) => set({ person, lastError: null }),

      /**
       * Runs the two skin calls and derives the profile.
       *
       * Tone is required and concerns are optional: tone drives the entire
       * apparel sort, whereas concerns only rank beauty-mode treatments. So a
       * concerns failure degrades the product slightly and a tone failure stops
       * onboarding — they are deliberately not treated the same way.
       */
      runScan: async () => {
        const { person } = get();
        if (!person) throw new Error('No photo captured yet.');

        set({ lastError: null });

        let tone: youcam.SkinToneResult;
        let readingSource: SkinProfile['readingSource'] = 'live';

        try {
          tone = await youcam.analyseSkinTone(person.face);
        } catch (error) {
          // A demo model carries a real measurement of that exact photo, taken
          // when credits were available. Falling back to it keeps onboarding
          // alive when the key runs dry — which is a hard stop otherwise, since
          // tone drives the entire apparel sort. The provenance is recorded and
          // shown, not hidden.
          const recorded = person.demoModelId
            ? findDemoModel(person.demoModelId)?.recordedSkinHex
            : undefined;
          if (!recorded) throw error;

          tone = {
            skinHex: recorded,
            hairHex: null,
            eyeHex: null,
            lipHex: null,
            eyeColorName: null,
            hairColorName: null,
          };
          readingSource = 'recorded';
        }

        let concerns: SkinConcern[] = [];
        try {
          if (readingSource === 'recorded') throw new Error('skip');
          const raw = await youcam.analyseSkinConcerns(person.face);
          concerns = raw.map((c) => ({
            type: c.type,
            label: CONCERN_LABELS[c.type] ?? c.type,
            rawScore: c.rawScore,
          }));
        } catch {
          // Non-fatal by design. Beauty mode says so on the card rather than
          // silently ranking treatments off data it does not have.
        }

        const { undertone, depth, confidence } = undertoneFromSkinHex(tone.skinHex);
        const contrast = contrastLevel(tone.skinHex, tone.hairHex);

        get().applyProfile({
          ...tone,
          undertone,
          depth,
          confidence,
          contrast,
          season: deriveSeason(undertone, depth, contrast),
          concerns,
          scanTimestamp: Date.now(),
          simulated: false,
          readingSource,
        });
      },

      applyProfile: (profile) => {
        set({ profile, onboarded: true });
        get().rebuildDeck();
      },

      /**
       * Re-derives the profile against a forced undertone.
       *
       * This exists so the product's central claim can be demonstrated in
       * seconds — the same catalogue re-sorting live — without a second person
       * and without spending 20 units on another tone scan.
       */
      setSimulatedUndertone: (simulatedUndertone) => {
        const { profile } = get();
        set({ simulatedUndertone });
        if (!profile) return;

        const base = undertoneFromSkinHex(profile.skinHex);
        const undertone = simulatedUndertone ?? base.undertone;
        const contrast = profile.contrast;

        set({
          profile: {
            ...profile,
            undertone,
            // A forced undertone is asserted, not measured, so it sorts at full
            // strength rather than inheriting the real scan's uncertainty.
            confidence: simulatedUndertone ? 1 : base.confidence,
            season: deriveSeason(undertone, profile.depth, contrast),
            simulated: simulatedUndertone !== null,
          },
        });
        get().rebuildDeck();
      },

      setMode: (mode) => {
        set({ mode, cursor: 0 });
        get().rebuildDeck();
      },

      /**
       * Rebuilds and re-sorts the deck, preserving any render already paid for.
       *
       * Renders are keyed on (person, product) rather than on deck position, so
       * re-sorting after an undertone change costs nothing.
       */
      rebuildDeck: () => {
        const { profile, mode, person, deck: previous } = get();
        if (!profile) return;

        const previousRenders = new Map(previous.map((c) => [c.product.id, c.render]));
        const swipedIds = new Set(get().swipes.map((s) => s.productId));

        const ordered = buildDeck(ALL_PRODUCTS, profile, mode);

        const deck: DeckCard[] = ordered.map(({ product, match }) => {
          const cached = person ? readCachedRender(person.key, product.id) : null;
          const carried = previousRenders.get(product.id);

          const render: RenderState = cached
            ? { status: 'ready', uri: cached, cached: true }
            : carried && carried.status === 'ready'
              ? carried
              : { status: 'queued' };

          return { product, match, regret: assessRegret(product, match, profile), render };
        });

        // Cards already swiped stay out of the deck rather than reappearing at a
        // new position after a re-sort.
        const remaining = deck.filter((c) => !swipedIds.has(c.product.id));

        set({ deck: remaining, cursor: Math.min(get().cursor, Math.max(0, remaining.length - 1)) });
      },

      /** Eager first batch, behind the preparing screen. */
      prefetchDeck: async () => {
        const { deck, mode } = get();
        // Beauty mode composites shades locally, so it has nothing to prerender.
        if (mode === 'beauty') return;

        const targets = deck.slice(0, PREFETCH_COUNT).filter((c) => c.render.status === 'queued');
        set({ prepareProgress: { done: 0, total: targets.length } });

        let done = 0;
        await Promise.all(
          targets.map(async (card) => {
            await renderCard(card.product, set, get);
            done += 1;
            set({ prepareProgress: { done, total: targets.length } });
          }),
        );
      },

      /** Keeps the pipeline full as the shopper advances. */
      ensureRendersAhead: () => {
        const { deck, cursor, mode } = get();
        if (mode === 'beauty') return;

        deck
          .slice(cursor, cursor + RENDER_LOOKAHEAD)
          .filter((c) => c.render.status === 'queued')
          .forEach((card) => void renderCard(card.product, set, get));
      },

      swipe: (direction) => {
        const { deck, cursor, profile } = get();
        const card = deck[cursor];
        if (!card || !profile) return;

        const event: SwipeEvent = {
          productId: card.product.id,
          direction,
          timestamp: Date.now(),
          matchScore: card.match.score,
        };

        const cart =
          direction === 'right'
            ? [
                ...get().cart,
                {
                  product: card.product,
                  addedAt: Date.now(),
                  sentToBrand: false,
                  renderUri: card.render.status === 'ready' ? card.render.uri : null,
                } satisfies CartItem,
              ]
            : get().cart;

        set({ swipes: [...get().swipes, event], cart, cursor: cursor + 1 });
        get().ensureRendersAhead();
      },

      undoSwipe: () => {
        const { swipes, cursor } = get();
        const last = swipes[swipes.length - 1];
        if (!last || cursor === 0) return;

        set({
          swipes: swipes.slice(0, -1),
          cursor: cursor - 1,
          cart:
            last.direction === 'right'
              ? get().cart.filter((item) => item.product.id !== last.productId)
              : get().cart,
        });
      },

      markCoachSeen: () => set({ coachSeen: true }),

      removeFromCart: (productId) =>
        set({ cart: get().cart.filter((i) => i.product.id !== productId) }),

      markSentToBrand: (productIds) =>
        set({
          cart: get().cart.map((i) =>
            productIds.includes(i.product.id) ? { ...i, sentToBrand: true } : i,
          ),
        }),

      clearCart: () => set({ cart: [] }),

      resetAll: () =>
        set({
          onboarded: false,
          coachSeen: false,
          person: null,
          profile: null,
          simulatedUndertone: null,
          deck: [],
          cursor: 0,
          swipes: [],
          cart: [],
          prepareProgress: { done: 0, total: 0 },
          lastError: null,
        }),
    }),
    {
      name: 'fitcheck-v1',
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * The deck is derived state and is rebuilt on rehydrate. Persisting it
       * would store presigned render URLs that expire after two hours, which
       * would restore a deck of broken images — the on-disk render cache is the
       * durable half, and `rebuildDeck` reconnects to it.
       */
      partialize: (state) => ({
        onboarded: state.onboarded,
        coachSeen: state.coachSeen,
        person: state.person,
        profile: state.profile,
        simulatedUndertone: state.simulatedUndertone,
        mode: state.mode,
        cursor: state.cursor,
        swipes: state.swipes,
        cart: state.cart,
      }),
      onRehydrateStorage: () => (state) => {
        state?.rebuildDeck();
      },
    },
  ),
);

/* -------------------------------------------------------------------------
 * Render pipeline
 * ---------------------------------------------------------------------- */

type Setter = (partial: Partial<State>) => void;
type Getter = () => State & Actions;

function patchRender(get: Getter, set: Setter, productId: string, render: RenderState) {
  set({
    deck: get().deck.map((card) => (card.product.id === productId ? { ...card, render } : card)),
  });
}

/**
 * Renders one card: try-on, then download to disk.
 *
 * The download matters as much as the render. API result URLs are presigned and
 * expire in two hours, so a render kept only as a URL is gone by the next
 * session and has to be paid for again.
 */
async function renderCard(product: Product, set: Setter, get: Getter): Promise<void> {
  const { person } = get();
  if (!person || inFlight.has(product.id)) return;

  const existing = get().deck.find((c) => c.product.id === product.id)?.render;
  if (existing && existing.status !== 'queued') return;

  inFlight.add(product.id);
  patchRender(get, set, product.id, { status: 'rendering' });

  try {
    const remoteUrl = await youcam.tryOnGarment(
      person.body,
      { kind: 'url', url: product.productImageUrl },
      product.category,
    );
    const localUri = await cacheRender(person.key, product.id, remoteUrl);
    patchRender(get, set, product.id, { status: 'ready', uri: localUri, cached: false });
  } catch (error) {
    // A failed render must never remove the card — it becomes a labelled card
    // that still swipes, so one bad garment image cannot end the session.
    const reason = error instanceof youcam.YouCamError ? error.message : 'Render unavailable.';
    patchRender(get, set, product.id, { status: 'failed', reason });
  } finally {
    inFlight.delete(product.id);
  }
}

/* -------------------------------------------------------------------------
 * Selectors
 * ---------------------------------------------------------------------- */

export const selectCurrentCard = (s: State) => s.deck[s.cursor] ?? null;

/**
 * Groups the bag by brand.
 *
 * Deliberately NOT a zustand selector. Zustand v5 compares snapshots with
 * Object.is, so a selector that builds a fresh array on every read never
 * compares equal and drives React's useSyncExternalStore into an infinite
 * re-render — it surfaces as "Maximum update depth exceeded" from whatever
 * layout happens to be mounted, which points nowhere near the real cause.
 *
 * Callers select the stable `cart` reference and memoise this themselves.
 */
export function groupCartByBrand(cart: CartItem[]): { brand: string; items: CartItem[] }[] {
  const groups = new Map<string, CartItem[]>();
  for (const item of cart) {
    const list = groups.get(item.product.brand) ?? [];
    list.push(item);
    groups.set(item.product.brand, list);
  }
  return [...groups.entries()].map(([brand, items]) => ({ brand, items }));
}
