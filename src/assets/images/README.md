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
| `photos/products/` | Sample product photos (`demo/`: the built-in demo shop and Home phone) |
| `photos/lifestyle/` | Sellers and people for marketing pages |
| `patterns/` | Background shapes and textures (`banners/`: the ready-made shop banners, ids in `convex/lib/looks/banners.ts`) |
| `icons/` | Custom SVG icons that `lucide-react` doesn't have |
| `stickers/` | Event banner stickers: swappable set, list in `manifest.ts` (see its README) |

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
  brand logos. Exception: the WhatsApp icon (`icons/whatsapp.png`), used
  only to show "order / chat on WhatsApp". Add every external file to the
  credits table below.

## Credits

| File | Source | License |
|---|---|---|
| `brand/vano-mobile.png` | Vano design team (not used right now: the Home phone renders the live demo shop) | Own work |
| `icons/whatsapp.png` | Vano design team (WhatsApp mark; landing hero and the shop order buttons, via `WhatsAppIcon`) | WhatsApp brand guidelines |
| `icons/link.png` | Vano design team | Own work |
| `stickers/*.svg` | Vano design team, simple geometric motifs (see `stickers/README.md`) | Own work |
| `patterns/banners/*.svg` (kitenge-diamonds, kitenge-waves, petals, gold-arcs, soft-dots) | Vano design team, original geometric and floral motifs | Own work |
| `photos/products/demo/slip-dress.webp` | https://unsplash.com/photos/PTFAGC9Whmg | Unsplash License |
| `photos/products/demo/slip-dress-2.webp` | https://unsplash.com/photos/qZRrpXgCio8 | Unsplash License |
| `photos/products/demo/kente-shirt.webp` | https://unsplash.com/photos/5buvyK3DPsI | Unsplash License |
| `photos/products/demo/printed-top.webp` | https://unsplash.com/photos/DVMRYuULLgk | Unsplash License |
| `photos/products/demo/wax-print-shirt.webp` | https://unsplash.com/photos/t3vn-jyl85U | Unsplash License |
| `photos/products/demo/blue-heels.webp` | https://unsplash.com/photos/yjwehHiMGpg | Unsplash License |
| `photos/products/demo/white-sunglasses.webp` | https://unsplash.com/photos/YZrlDELuvHQ | Unsplash License |
| `photos/products/demo/wide-brim-hat.webp` | https://unsplash.com/photos/2KTODAQ3q9Y | Unsplash License |
| `photos/products/demo/wide-brim-hat-2.webp` | https://unsplash.com/photos/7Nb3YHCpNIs | Unsplash License |
| `photos/products/demo/leather-jacket.webp` | https://unsplash.com/photos/PbiYceITwt0 | Unsplash License |
| `photos/products/demo/kente-crop-top.webp` | https://unsplash.com/photos/ZrprnquSplY | Unsplash License |
| `photos/products/demo/kente-crop-top-2.webp` | https://unsplash.com/photos/_VYEcLzGJYk | Unsplash License |
