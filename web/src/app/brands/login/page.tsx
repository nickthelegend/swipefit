'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthShell, Field, Notice } from '@/components/auth-shell';
import { PillButton } from '@/components/ui/kit';
import { createClient, supabaseConfigured } from '@/lib/supabase';

export default function BrandLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured()) {
      setError('Supabase is not configured on this deployment.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push('/brands/console');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      kicker="Partner access"
      title="Console login"
      lede="Your console shows what shoppers actually did in front of your pieces — the dwell, the hesitation, the reversal."
      aside={
        <p className="text-[15px]">
          Not a partner yet?{' '}
          <Link href="/brands/join" className="font-semibold underline underline-offset-4">
            Claim your brand
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <Field
          label="Work email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@brand.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <PillButton type="submit" accent="violet" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </PillButton>
      </form>
    </AuthShell>
  );
}
