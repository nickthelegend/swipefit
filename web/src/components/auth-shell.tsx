import type { ReactNode } from 'react';

import { Starburst } from '@/components/doodles';
import { Panel, Tag } from '@/components/ui/kit';

export function AuthShell({
  kicker,
  title,
  lede,
  children,
  aside,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="grid-paper min-h-[calc(100vh-4rem)]">
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <Tag accent="acid">{kicker}</Tag>
          <h1 className="display mt-5 text-[clamp(36px,6vw,60px)]">{title}</h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed">{lede}</p>
          {aside && <div className="mt-8">{aside}</div>}
        </div>

        <div className="relative">
          <div className="absolute -left-6 -top-6 z-10">
            <Starburst size={54} fill="#EBD22F" rotate={-14} />
          </div>
          <Panel className="p-7">{children}</Panel>
        </div>
      </div>
    </section>
  );
}

/** Outlined field. Focus is the ink outline, never a browser default ring. */
export function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & React.ComponentProps<'input'>) {
  return (
    <label className="block">
      <span className="label block text-[11px]">{label}</span>
      <input
        {...rest}
        className="mt-2 h-12 w-full rounded-[13px] border-2 border-black bg-white px-4 text-[15px] outline-none placeholder:text-black/35 focus:shadow-hard-sm"
      />
      {hint && <span className="mt-1.5 block text-[12px] opacity-60">{hint}</span>}
    </label>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'ok' | 'info';
  children: ReactNode;
}) {
  const fill =
    tone === 'error'
      ? 'bg-[#E9492D] text-white'
      : tone === 'ok'
        ? 'bg-[#1F8D42] text-white'
        : 'bg-[#EBD22F] text-black';

  return (
    <div className={`rounded-[13px] border-2 border-black px-4 py-3 text-[14px] leading-relaxed ${fill}`}>
      {children}
    </div>
  );
}
