# UI images & illustrations

Design assets used by the Vano interface. Components **statically import**
them and render them with `next/image`:

```tsx
import emptyBox from "@/assets/images/illustrations/empty-states/empty-box.svg"
<Image src={emptyBox} alt={t("emptyAlt")} />
```

That gives width/height automatically (no layout shift), a blur
placeholder for photos, and hashed URLs that are cached forever. A missing
file is a build error. Use `public/` only for files that need a fixed URL
(favicons, images linked from emails).

## Folders

| Folder | What goes in it |
|---|---|
| `brand/` | Logo mark, wordmark, app icon sources (SVG) |
| `illustrations/empty-states/` | No products yet, no shops, no search results… |
| `illustrations/onboarding/` | Welcome and create-shop steps |
| `illustrations/errors/` | 404, error page, shop suspended / unavailable |
| `illustrations/marketing/` | Landing page spot art, coming-soon teasers |
| `photos/products/` | Sample product photos (landing mockup, demo grid) |
| `photos/lifestyle/` | Sellers and people for marketing pages |
| `patterns/` | Background shapes and textures |
| `icons/` | Custom SVG icons that `lucide-react` doesn't have |

## Conventions

- **Names**: kebab-case, describing the content, not where it's used
  (`empty-box.svg`, not `dashboard-img2.svg`). Variants get a suffix:
  `-dark`, `-sm`.
- **Illustrations, icons, brand**: SVG, optimized with SVGO, using the brand
  palette: coral `#F4511E`, ink `#1A1412`, cream `#FFF8F3`, blush
  `#FFE3D6`, plum `#5B1F4A`. Icons use `currentColor` so they follow text color.
- **Photos**: WebP, max 1600px on the long side, ≤ 200 KB (`next/image`
  resizes further for each screen).
- **No text inside images**: it can't be translated. Alt text comes from
  `messages/en.json` + `messages/fr.json`; use `alt=""` only for purely
  decorative images.
- **Licensing**: own work or free-license only, and no visible third-party
  brand logos. Add every external file to the credits table below.

## Credits

| File | Source | License |
|---|---|---|
| `photos/products/red-dress.webp` | https://images.unsplash.com/photo-1595777457583-95e059d581b8 | Unsplash License |
| `photos/products/red-bag.webp` | https://images.unsplash.com/photo-1584917865442-de89df76afd3 | Unsplash License |
| `photos/products/floral-heels.webp` | https://images.unsplash.com/photo-1543163521-1bf539c55dd2 | Unsplash License |
| `photos/products/bomber-jacket.webp` | https://images.unsplash.com/photo-1591047139829-d91aecb6caea | Unsplash License |
| `photos/products/knit-poncho.webp` | https://images.unsplash.com/photo-1434389677669-e08b4cac3105 | Unsplash License |
| `photos/products/yellow-set.webp` | https://images.unsplash.com/photo-1515886657613-9f3515b0c78f | Unsplash License |
