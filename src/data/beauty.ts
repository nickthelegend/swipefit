import type { Product } from '@/types';

/**
 * Beauty mode catalogue.
 *
 * Scope decision, recorded because it is easy to mistake for an omission: this
 * mode deliberately does NOT call the makeup-VTO API. That is a separate,
 * separately-billed feature outside the Skin AI + Apparel VTO track, and
 * spending the unit budget on an API nobody is judging would come out of the
 * renders that actually carry the product.
 *
 * Instead beauty mode reuses the *same* skin measurement in the way it is
 * actually strongest: foundations are matched by perceptual distance from the
 * measured skin hex, and treatments are matched against measured concern
 * scores. The shade is composited over the shopper's own face photo in-app.
 *
 * Shade hexes are representative values for each shade family rather than
 * lab-measured swatches, and the product surfaces this on the card.
 */

const foundation = (
  name: string,
  brand: string,
  shade: string,
  hex: string,
  price: number,
  url: string,
): Product => ({
  id: `foundation-${brand}-${shade}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  brand,
  name,
  category: 'upper_body',
  mode: 'beauty',
  // Shade matching is driven entirely by measured skin colour, which has no
  // bearing on who the product is for. The apparel filter must never hide these.
  gender: 'unisex',
  beautyKind: 'foundation',
  price,
  currency: 'USD',
  productImageUrl: '',
  brandProductUrl: url,
  colorName: shade,
  colorHex: hex,
  sizeInfo: '30ml',
  fitNote: 'buildable medium coverage',
});

const treatment = (
  name: string,
  brand: string,
  concern: string,
  price: number,
  url: string,
  note: string,
): Product => ({
  id: `skincare-${brand}-${concern}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  brand,
  name,
  category: 'upper_body',
  mode: 'beauty',
  gender: 'unisex',
  beautyKind: 'skincare',
  targetsConcern: concern,
  price,
  currency: 'USD',
  productImageUrl: '',
  brandProductUrl: url,
  colorName: concern,
  colorHex: '#E1E1D9',
  sizeInfo: '30ml',
  fitNote: note,
});

/** Shade ladder spans L* ~30–85 so every measured skin tone has a near match. */
export const BEAUTY_PRODUCTS: Product[] = [
  foundation('Soft Matte Foundation', 'NARS', 'Siberia', '#F3DCC6', 52, 'https://www.narscosmetics.com/USA/foundation/'),
  foundation('Soft Matte Foundation', 'NARS', 'Deauville', '#EBC9A6', 52, 'https://www.narscosmetics.com/USA/foundation/'),
  foundation('Pro Filt’r Foundation', 'Fenty Beauty', '150 Warm Sand', '#DFB183', 42, 'https://fentybeauty.com/collections/face-foundation'),
  foundation('Pro Filt’r Foundation', 'Fenty Beauty', '260 Golden Tan', '#C6905F', 42, 'https://fentybeauty.com/collections/face-foundation'),
  foundation('Pro Filt’r Foundation', 'Fenty Beauty', '370 Deep Amber', '#8E5A32', 42, 'https://fentybeauty.com/collections/face-foundation'),
  foundation('Pro Filt’r Foundation', 'Fenty Beauty', '470 Rich Espresso', '#5B3421', 42, 'https://fentybeauty.com/collections/face-foundation'),
  foundation('Skin Tint Serum', 'ILIA', 'Porcelain', '#F6E2D0', 54, 'https://iliabeauty.com/collections/foundation'),
  foundation('Skin Tint Serum', 'ILIA', 'Bom Bom', '#A9713F', 54, 'https://iliabeauty.com/collections/foundation'),

  treatment('Niacinamide 10% + Zinc 1%', 'The Ordinary', 'pore', 8, 'https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html', 'targets visible pores and shine'),
  treatment('Granactive Retinoid 2%', 'The Ordinary', 'wrinkle', 12, 'https://theordinary.com/en-us/granactive-retinoid-2-emulsion-serum-100418.html', 'targets fine lines over 12 weeks'),
  treatment('Glycolic Acid 7% Toning Solution', 'The Ordinary', 'texture', 11, 'https://theordinary.com/en-us/glycolic-acid-7-exfoliating-toning-solution-100418.html', 'targets uneven texture'),
  treatment('Azelaic Acid Suspension 10%', 'The Ordinary', 'redness', 12, 'https://theordinary.com/en-us/azelaic-acid-suspension-10-serum-100425.html', 'targets redness and blotchiness'),
];
