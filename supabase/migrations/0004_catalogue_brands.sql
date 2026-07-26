-- FITCHECK — catalogue brands
--
-- Seeds every brand present in the shipping catalogue, with the same accent the
-- app assigns it (first-appearance order through a four-colour cycle), so a
-- brand wears one colour across the deck, the bag, the directory and the
-- console.
--
-- Generated from src/data/catalog.json rather than written by hand: the accent
-- depends on brand ORDER in that file, so hand-maintaining this drifts silently
-- the moment the catalogue is regenerated.
--
-- Idempotent: safe to re-run after the catalogue grows.

insert into public.brands (name, slug, accent, blurb, website, approved)
values
  ('COS', 'cos', 'violet', 'Modern, functional, considered design. 8 pieces in the FITCHECK catalogue.', 'https://www.cos.com', true),
  ('Uniqlo', 'uniqlo', 'tomato', 'LifeWear — everyday essentials engineered for fit. 8 pieces in the FITCHECK catalogue.', 'https://www.uniqlo.com', true),
  ('Levi''s', 'levis', 'forest', 'The original denim house. 8 pieces in the FITCHECK catalogue.', 'https://www.levi.com', true),
  ('H&M', 'hm', 'acid', 'Wide colour range across every category. 6 pieces in the FITCHECK catalogue.', 'https://www.hm.com', true),
  ('Zara', 'zara', 'violet', 'Fast-moving fashion, broad silhouette range. 7 pieces in the FITCHECK catalogue.', 'https://www.zara.com', true),
  ('Massimo Dutti', 'massimodutti', 'tomato', 'Tailored, muted, quietly premium. 6 pieces in the FITCHECK catalogue.', 'https://www.massimodutti.com', true),
  ('A.P.C.', 'apc', 'forest', 'French minimalism and raw denim, unchanged since 1987. 6 pieces in the FITCHECK catalogue.', 'https://www.apc.fr', true),
  ('Sunspel', 'sunspel', 'acid', 'English cotton, made in Long Eaton since 1860. 6 pieces in the FITCHECK catalogue.', 'https://www.sunspel.com', true),
  ('Outerknown', 'outerknown', 'violet', 'Organic and recycled fibre, built to last. 5 pieces in the FITCHECK catalogue.', 'https://www.outerknown.com', true)
on conflict (name) do update
  set slug     = excluded.slug,
      accent   = excluded.accent,
      blurb    = excluded.blurb,
      website  = excluded.website,
      approved = true;
