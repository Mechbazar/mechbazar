// Resolves a Banner's `redirectLink` (admin-entered, free text) into what
// tapping/clicking the banner's CTA should actually do. Pulled out into one
// place because the same http(s)-vs-category-name logic used to be hand
// duplicated across HomeScreen.tsx/HomeScreenMobile.tsx/HeroCarousel.tsx --
// exactly the kind of drift that let the native app's "Shop Now" button end
// up wired to the search handler instead of this logic at all.
export type BannerLinkAction =
  | { type: 'external'; url: string }
  | { type: 'category'; categoryName: string }
  | { type: 'categories' };

// Admins type things like "mechbazar.com/sale" or "www.mechbazar.com"
// without the http(s):// prefix; treating those as a (nonexistent) category
// name instead of a link is exactly the "URL not working" bug being fixed
// here. Requires a dot and no whitespace so real category names (e.g.
// "Brake System") never match this by accident.
const DOMAIN_LIKE = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

export function resolveBannerLink(rawLink: string | null | undefined): BannerLinkAction {
  const link = (rawLink || '').trim();
  if (!link) return { type: 'categories' };
  if (/^https?:\/\//i.test(link)) return { type: 'external', url: link };
  if (DOMAIN_LIKE.test(link)) return { type: 'external', url: `https://${link}` };
  return { type: 'category', categoryName: link };
}
