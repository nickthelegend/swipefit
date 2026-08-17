import Link from 'next/link';

import { Chevrons } from '@/components/doodles';

export default function Footer() {
  return (
    <footer className="border-t-2 border-black bg-black text-[#FA9DCD]">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Chevrons size={40} fill="#EBD22F" />
              <span className="display text-[30px]">SwipeFit</span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed opacity-80">
              The face decides what you wear. A try-on and discovery layer that sits in front of
              retail — never a marketplace competing with it.
            </p>
          </div>

          <div className="flex gap-14">
            <div>
              <div className="label mb-3 text-[11px] opacity-60">Product</div>
              <ul className="space-y-2 text-[14px]">
                <li><Link href="/" className="hover:text-[#EBD22F]">The app</Link></li>
                <li><Link href="/download" className="hover:text-[#EBD22F]">Download</Link></li>
                <li><Link href="/brands" className="hover:text-[#EBD22F]">Brands</Link></li>
              </ul>
            </div>
            <div>
              <div className="label mb-3 text-[11px] opacity-60">For brands</div>
              <ul className="space-y-2 text-[14px]">
                <li><Link href="/brands/join" className="hover:text-[#EBD22F]">Become a partner</Link></li>
                <li><Link href="/brands/login" className="hover:text-[#EBD22F]">Console login</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[#FA9DCD]/25 pt-6 text-[12px] opacity-70">
          <p>
            Built on YouCam Skin AI and Apparel VTO. Product imagery and links belong to their
            respective brands. Visual direction after byooooob.com.
          </p>
        </div>
      </div>
    </footer>
  );
}
