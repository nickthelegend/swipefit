'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthShell, Field, Notice } from '@/components/auth-shell';
import { PillButton, Tag } from '@/components/ui/kit';
import { createClient, supabaseConfigured } from '@/lib/supabase';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export default function BrandJoin() {
  const router = useRouter();
  const [brand, setBrand] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured()) {
      setError('Supabase is not configured on this deployment.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for the password.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      // With email confirmation enabled there is no session yet, so the brand
      // row cannot be written under the owner's identity. Saying so is better
      // than silently succeeding at half the job.
      if (!data.session) {
        setPending(true);
        return;
      }

      const { error: brandError } = await supabase.from('brands').insert({
        name: brand.trim(),
        slug: slugify(brand),
        website: website.trim() || null,
        owner_id: data.session.user.id,
        approved: false,
      });

      if (brandError) {
        setError(
          brandError.code === '23505'
            ? 'That brand name is already claimed. Sign in instead, or use the exact registered name.'
            : brandError.message,
        );
        return;
      }

      router.push('/brands/console');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <AuthShell
        kicker="Almost there"
        title="Check your inbox"
        lede="Confirm the email we just sent, then sign in and your brand claim will be created."
      >
        <div className="space-y-5">
          <Notice tone="ok">Confirmation sent to {email}.</Notice>
          <PillButton
            type="button"
            accent="violet"
            className="w-full"
            onClick={() => router.push('/brands/login')}
          >
            Go to sign in
          </PillButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Become a partner"
      title="Claim your brand"
      lede="Send us a flat-lay feed and a product URL per SKU. You get a console showing the hesitation before the buy, and the traffic lands on your own site."
      aside={
        <div className="space-y-3">
          <Tag accent="paper">No revenue share</Tag>
          <p className="text-[15px]">
            Already registered?{' '}
            <Link href="/brands/login" className="font-semibold underline underline-offset-4">
              Sign in
            </Link>
            .
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <Field
          label="Brand name"
          required
          placeholder="COS"
          hint="Must match the name on your product pages."
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <Field
          label="Website"
          type="url"
          placeholder="https://www.yourbrand.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <PillButton type="submit" accent="violet" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Claim brand'}
        </PillButton>

        <p className="text-[12px] leading-relaxed opacity-60">
          Claims are reviewed before the brand appears in the public directory. Your console works
          immediately either way.
        </p>
      </form>
    </AuthShell>
  );
}
