import { Redirect } from 'expo-router';

import { useAppStore } from '@/store/useAppStore';

/**
 * Boot router. A returning shopper with a stored skin profile goes straight to
 * the deck — the scan is a one-time cost by design, and it also costs 20 units,
 * so re-running it on every launch would be expensive as well as rude.
 */
export default function Index() {
  const onboarded = useAppStore((s) => s.onboarded);
  const hasProfile = useAppStore((s) => s.profile !== null);

  return <Redirect href={onboarded && hasProfile ? '/(app)/swipe' : '/onboarding'} />;
}
