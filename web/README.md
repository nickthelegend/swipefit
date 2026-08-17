This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

# SwipeFit — web

Landing page, brand directory, and the brand console.

## Run

```bash
npm install
cp .env.local.example .env.local   # add your Supabase publishable key
npm run dev
```

## Routes

| Route | What it is |
|---|---|
| `/` | Landing — the app, the loop, the numbers behind the sort |
| `/download` | Android APK (direct) + Mac/iOS from source |
| `/brands` | Public brand directory, and the partner pitch |
| `/brands/join` | Brand signup — claims a brand against a Supabase account |
| `/brands/login` | Partner sign-in |
| `/brands/console` | The app's Signal screen, on the web, scoped to your brand |

## Supabase

Apply both migrations from the repo root, in order, via **SQL Editor**:

1. `supabase/migrations/0001_init.sql` — telemetry tables, RLS, aggregate views
2. `supabase/migrations/0002_brands.sql` — brands, ownership, per-brand views

**Publishable key only.** The service-role key bypasses Row Level Security; in a
browser bundle it would hand full read/write on the database to any visitor.

## The APK

`public/builds/` is gitignored — the debug APK is 91 MB. Regenerate with:

```bash
cd ..           # repo root
npx expo run:android
cp android/app/build/outputs/apk/debug/app-debug.apk web/public/builds/swipefit-latest.apk
```

## Design

Tokens are identical to the mobile app's `src/theme/tokens.ts`, so the two
surfaces read as one product. Pink ground `#FA9DCD`, 1–2px black hairlines,
one hard shadow (`4px 5px 0`, never blurred), Archivo only.
