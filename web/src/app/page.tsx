import Image from 'next/image';

import { Blob, Chevrons, Cursor, Eyes, Globe, IconAndroid, IconApple, Squiggle, Starburst } from '@/components/doodles';
import { Panel, PillLink, Sticker, Tag } from '@/components/ui/kit';

/**
 * Landing — Persuade.
 *
 * THESIS: the merchandise is you. The page refuses the category default (a
 * gradient hero, a floating phone in perspective, three feature cards with
 * icons) and instead puts the actual rendered card at full scale in the first
 * viewport, because the render IS the argument — everything else on this page
 * is a caption for it.
 */
export default function Home() {
  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="grid-paper border-b-2 border-black">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <Tag accent="acid">YouCam Skin AI + Apparel VTO</Tag>

            <h1 className="mt-6">
              <span className="display block text-[clamp(48px,9vw,86px)]">The</span>
              <span className="flex flex-wrap items-center gap-4">
                <span className="display text-[clamp(48px,9vw,86px)]">Face</span>
                <Eyes size={104} fill="#FFFFFF" rotate={-4} />
              </span>
              <span className="relative block">
                <span className="display block text-[clamp(48px,9vw,86px)] text-[#4D17F5]">
                  Decides
                </span>
                <Squiggle size={260} stroke="#E9492D" rotate={-1} className="-mt-2 ml-1" />
              </span>
              <span className="flex flex-wrap items-center gap-4">
                <Chevrons size={64} fill="#1F8D42" />
                <span className="display text-[clamp(48px,9vw,86px)]">What</span>
              </span>
              <span className="display block text-[clamp(48px,9vw,86px)]">You Wear</span>
            </h1>

            <p className="mt-7 max-w-lg text-[17px] leading-relaxed">
              One skin scan decides which clothes you see. Then every card is that garment
              rendered on your actual body — not a model&apos;s.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillLink href="/download" accent="violet">
                <IconAndroid size={20} color="#fff" />
                Get the APK
              </PillLink>
              <PillLink href="/download" accent="paper">
                <IconApple size={20} />
                Mac &amp; iOS
              </PillLink>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Cursor size={26} rotate={128} />
              <span className="text-[13px] font-semibold uppercase tracking-[0.06em] opacity-70">
                Free. No account. Two photos and you&apos;re in.
              </span>
            </div>
          </div>

          {/* The render, at the scale the argument deserves. */}
          <div className="relative mx-auto w-full max-w-[360px]">
            <div className="absolute -left-6 -top-6 z-10">
              <Sticker kicker="Match" value="81" accent="acid" rotate={-7} />
            </div>
            <div className="absolute -right-4 top-16 z-10">
              <Starburst size={62} fill="#E9492D" rotate={14} />
            </div>
            <div className="overflow-hidden rounded-[30px] border-2 border-black bg-white shadow-hard-lg">
              <Image
                src="/shots/deck.png"
                alt="A FITCHECK card showing a garment rendered onto the shopper's own photograph"
                width={1080}
                height={2400}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee ------------------------------------------------------- */}
      <section className="overflow-hidden border-b-2 border-black bg-black py-4">
        <div className="marquee flex w-max gap-8 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, pass) => (
            <div key={pass} className="flex gap-8" aria-hidden={pass === 1}>
              {[
                'Rendered on you, not a model',
                'The scan sorts the rail',
                'No payment — a handoff',
                'Return risk before you commit',
                'Two garments, one look',
              ].map((phrase) => (
                <span key={phrase} className="display text-[22px] text-[#FA9DCD]">
                  {phrase} <span className="text-[#EBD22F]">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* The claim, with the number behind it --------------------------- */}
      <section className="border-b-2 border-black">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="display max-w-2xl text-[clamp(34px,5vw,54px)]">
              The scan is not a beauty side-quest. It is the sort key.
            </h2>
            <Blob size={80} fill="#4D17F5" rotate={-10} />
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Panel tone="acid" className="p-7">
              <div className="display text-[54px] leading-none">24/24</div>
              <p className="mt-3 text-[15px] leading-relaxed">
                items change position between a warm-undertone and a cool-undertone shopper,
                against an identical 24-piece catalogue.
              </p>
            </Panel>
            <Panel tone="violet" className="p-7">
              <div className="display text-[54px] leading-none">0/6</div>
              <p className="mt-3 text-[15px] leading-relaxed">
                overlap in the top six. The two people are shown a genuinely different rail, not a
                reshuffle of the same favourites.
              </p>
            </Panel>
            <Panel className="p-7">
              <div className="display text-[54px] leading-none">CIELAB</div>
              <p className="mt-3 text-[15px] leading-relaxed">
                The API returns colour only — no undertone field. Every warm/cool judgement is
                derived here, in perceptual colour space.
              </p>
            </Panel>
          </div>

          <p className="mt-8 max-w-3xl text-[15px] leading-relaxed opacity-80">
            The neutral axis is a curve, not a constant. As lightness falls, b* compresses faster
            than a*, so a fixed threshold reads <em>every</em> deep skin tone as cool. Verified
            against 18 reference tones spanning L* 16–89.
          </p>
        </div>
      </section>

      {/* The loop ------------------------------------------------------ */}
      <section className="border-b-2 border-black bg-[#FDC7E2]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex items-center gap-4">
            <Chevrons size={54} fill="#4D17F5" />
            <h2 className="display text-[clamp(32px,4.5vw,48px)]">The whole loop</h2>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              {
                n: '01',
                t: 'Two shots',
                d: 'A face for the skin scan, a standing shot for the try-on. Different framing rules, so they cannot be one photo.',
              },
              {
                n: '02',
                t: 'The rail re-sorts',
                d: 'Undertone, depth and season are derived from the measured skin colour, then the catalogue is scored against them.',
              },
              {
                n: '03',
                t: 'Swipe',
                d: 'Every card is a live render on your body. A verdict line says why it scored what it scored.',
              },
              {
                n: '04',
                t: 'Handoff',
                d: 'Checkout takes no payment. Each item opens the brand’s own product page.',
              },
            ].map((step) => (
              <li key={step.n}>
                <Panel className="h-full p-6">
                  <div className="label text-[11px] opacity-50">{step.n}</div>
                  <h3 className="display mt-2 text-[24px]">{step.t}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed">{step.d}</p>
                </Panel>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Build the fit ------------------------------------------------- */}
      <section className="border-b-2 border-black">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <Tag accent="forest">Only here</Tag>
            <h2 className="display mt-5 text-[clamp(32px,4.5vw,52px)]">Build the fit</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed">
              The try-on API takes one garment per call, so every card renders a top over whatever
              trousers you happened to be photographed in. FITCHECK chains it: the rendered top
              becomes the input body for the bottom.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed opacity-75">
              One image. The whole outfit. On you.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[320px]">
            <div className="absolute -right-5 -top-5 z-10">
              <Starburst size={70} fill="#EBD22F" rotate={-12} />
            </div>
            <div className="overflow-hidden rounded-[23px] border-2 border-black bg-white shadow-hard-lg">
              <Image
                src="/shots/bag.png"
                alt="The FITCHECK bag, grouped by brand, each item showing its rendered try-on"
                width={1080}
                height={2400}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* For brands ---------------------------------------------------- */}
      <section className="border-b-2 border-black bg-black text-[#FA9DCD]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="overflow-hidden rounded-[23px] border-2 border-[#FA9DCD] bg-white">
              <Image
                src="/shots/console.png"
                alt="The FITCHECK brand console showing measured decision friction per SKU"
                width={1080}
                height={2400}
                className="h-auto w-full"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <Globe size={46} fill="#EBD22F" />
              <span className="label text-[12px] opacity-70">For retail partners</span>
            </div>

            <h2 className="display mt-5 text-[clamp(32px,4.5vw,52px)]">
              You already know your conversion rate.
            </h2>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed opacity-90">
              What you have never been able to see is the hesitation <em>before</em> the buy — how
              long someone looked, whether they opened the detail, whether they started to say yes
              and pulled back. That is where returns begin, and it happens entirely before any
              event your analytics can observe.
            </p>

            <ul className="mt-7 space-y-2 text-[15px] opacity-90">
              {[
                'Decision friction per SKU — dwell, inspect, hesitation, reversal',
                'Colour rejection segmented by measured undertone',
                'Bag → handoff rate, and the traffic behind it',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-[#EBD22F]">✳</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <PillLink href="/brands/join" accent="acid">
                Become a partner
              </PillLink>
              <PillLink href="/brands" accent="paper">
                See the brands
              </PillLink>
            </div>
          </div>
        </div>
      </section>

      {/* Download ------------------------------------------------------ */}
      <section id="download" className="grid-paper">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <div className="flex justify-center">
            <Starburst size={86} fill="#EBD22F" rotate={-14} />
          </div>
          <h2 className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,6vw,68px)]">
            Put it on before you buy it
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed">
            Android APK is a direct download. Mac and iOS run from source. Free, no account.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <PillLink href="/download" accent="violet">
              <IconAndroid size={20} color="#fff" />
              Download for Android
            </PillLink>
            <PillLink href="/download" accent="paper">
              <IconApple size={20} />
              Run on Mac &amp; iOS
            </PillLink>
          </div>
        </div>
      </section>
    </>
  );
}
