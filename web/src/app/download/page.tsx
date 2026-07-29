import build from '@/data/build-info.json';
import type { Metadata } from 'next';

import { Blob, Cursor, IconAndroid, IconApple, IconDownload, Starburst } from '@/components/doodles';
import { Panel, PillAnchor, Tag } from '@/components/ui/kit';

export const metadata: Metadata = {
  title: 'Download FITCHECK',
  description: 'Android APK direct download. Mac and iOS run from source. Free, no account.',
};

/**
 * Download — Persuade, but short.
 *
 * Someone arriving here has already decided. The job is to hand them the file
 * and set expectations honestly about what the build needs (a YouCam key, and
 * a real camera for the capture flow), rather than to sell again.
 */
export default function Download() {
  return (
    <>
      <section className="grid-paper border-b-2 border-black">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <div className="flex justify-center">
            <Starburst size={80} fill="#EBD22F" rotate={-12} />
          </div>
          <h1 className="display mt-6 text-[clamp(42px,8vw,78px)]">Get FITCHECK</h1>
          <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed">
            Free, no account, and the skin scan runs once. Two photos and you&apos;re swiping.
          </p>
        </div>
      </section>

      <section className="border-b-2 border-black">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <div className="grid gap-6 md:grid-cols-2">
            <Panel className="p-8">
              <div className="flex items-center gap-3">
                <IconAndroid size={30} />
                <h2 className="display text-[28px]">Android</h2>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed">
                Direct APK. Android 8.0 or newer, arm64. You will need to allow installs from
                unknown sources — it is not on Play yet.
              </p>

              {/*
                The button appears only once an APK has actually been published.
                A download link that 404s is worse than an honest instruction,
                and this page is reached by people who have already decided to
                trust a sideload.
              */}
              {build.published ? (
                <>
                  <div className="mt-6">
                    <PillAnchor href="/builds/fitcheck-latest.apk" accent="violet" download>
                      <IconDownload size={18} color="#fff" />
                      Download APK
                    </PillAnchor>
                  </div>
                  <p className="mt-4 text-[12px] uppercase tracking-[0.06em] opacity-55">
                    v{build.version} · {build.sizeLabel} · arm64-v8a · built {build.builtAt}
                  </p>

                  {/*
                    Nothing stands between this file and the device — no store
                    review, no signature check the user sees, and they had to
                    turn off a warning to get here. The hash is the only way to
                    confirm the file received is the file that was built.
                  */}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[12px] uppercase tracking-[0.06em] opacity-55">
                      Verify this download
                    </summary>
                    <p className="mt-3 text-[13px] leading-relaxed opacity-80">
                      SHA-256, signed as <code className="font-mono">{build.signer}</code>:
                    </p>
                    <code className="mt-2 block overflow-x-auto rounded-[9px] border-2 border-black bg-white p-3 font-mono text-[11px] leading-relaxed">
                      {build.sha256}
                    </code>
                    <code className="mt-2 block overflow-x-auto rounded-[9px] border-2 border-black bg-white p-3 font-mono text-[11px]">
                      shasum -a 256 fitcheck-latest.apk
                    </code>
                  </details>
                </>
              ) : (
                <p className="mt-6 text-[15px] leading-relaxed">
                  No build is published right now. Clone the repo and run{' '}
                  <code className="font-mono text-[13px]">npm run apk:build</code> — the APK lands
                  in <code className="font-mono text-[13px]">android/app/build/outputs/apk/release</code>.
                </p>
              )}
            </Panel>

            {/* No Mac binary exists — this is a React Native mobile app. Saying
                so beats shipping a button that downloads nothing. */}
            <Panel className="p-8">
              <div className="flex items-center gap-3">
                <IconApple size={30} />
                <h2 className="display text-[28px]">Mac &amp; iOS</h2>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed">
                There is no Mac binary — FITCHECK is a React Native app, so it runs on the iOS
                Simulator or a device rather than as a desktop build. Run it from source:
              </p>
              <pre className="mt-4 overflow-x-auto rounded-[9px] border border-black bg-[#FDC7E2] px-4 py-3 text-[13px]">
{`git clone <repo> && cd swipe-fit
npm install
npx expo run:ios`}
              </pre>
              <div className="mt-6">
                <PillAnchor
                  href="https://docs.expo.dev/get-started/set-up-your-environment/"
                  accent="paper"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Expo setup guide
                </PillAnchor>
              </div>
              <p className="mt-4 text-[12px] uppercase tracking-[0.06em] opacity-55">
                Xcode required · unsigned
              </p>
            </Panel>
          </div>

          {/* Said plainly rather than discovered after install. */}
          <Panel tone="acid" className="mt-8 p-7">
            <div className="flex items-start gap-4">
              <Cursor size={30} rotate={128} />
              <div>
                <h3 className="display text-[22px]">Before you run it</h3>
                <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
                  <li>
                    <strong>A YouCam API key is required.</strong> The try-on and skin scan are
                    live API calls. Put yours in <code>.env</code> as{' '}
                    <code>EXPO_PUBLIC_YOUCAM_API_KEY</code>.
                  </li>
                  <li>
                    <strong>On an emulator, use a bundled demo person.</strong> An emulator camera
                    renders a synthetic test scene with no human in it, so the capture flow cannot
                    be exercised there. Three demo people ship with the app.
                  </li>
                  <li>
                    <strong>Renders cost units.</strong> A full 24-card deck is about 48; a
                    complete run with the skin scan is around 85.
                  </li>
                </ul>
              </div>
            </div>
          </Panel>

          <div className="mt-10 flex items-center gap-4">
            <Blob size={54} fill="#4D17F5" rotate={-8} />
            <div>
              <Tag accent="paper">Source</Tag>
              <p className="mt-2 text-[15px]">
                Build it yourself:{' '}
                <code className="rounded border border-black bg-white px-2 py-0.5 text-[13px]">
                  npx expo run:android
                </code>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
