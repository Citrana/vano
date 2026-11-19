# Event banner stickers

Decorative stickers sellers add to their event & promo banners
(CLAUDE.md "Shop looks"). Everything about them is described by the list
in **`manifest.ts`**; `files.ts` imports one file per entry.

## Replacing the set (e.g. a commissioned illustrator's set)

1. Keep the file names in `manifest.ts` and drop the new SVGs in their
   place. **No code change.** Every seller's banner picks them up.
2. Full-colour illustrations: set the entry's `tint` to `"none"` (shown as
   drawn). One-colour silhouettes stay `"palette"` (recoloured with the
   banner palette's sticker colour, through a CSS mask: only the shape's
   opacity matters, any fill colour works).
3. Update `aspect` (width / height) if the artwork's shape changed.

## Adding a sticker

1. Add the SVG here.
2. Add one entry to `STICKERS` in `manifest.ts` (`id`, `file`, `category`,
   `tint`, `aspect`, `keywords`), and one import line to `files.ts` (the
   typecheck fails until you do).
3. Add the label `EventBanners.stickers.<id>` to `messages/en.json` and
   `messages/fr.json`.

Never rename or remove an `id` already in use: it's stored in sellers'
banners (the server accepts only ids from `manifest.ts`). Retire a sticker
by replacing its file instead.

## File rules

- SVG, `viewBox` matching `aspect`, no text (it can't be translated), no
  embedded raster images, optimized (SVGO).
- Original artwork only: no characters, logos, brand marks, or imitations
  of a specific artist's work. Generic motifs (hearts, stars, flowers,
  geometric shapes) are fine.
- Add every file that isn't Vano's own work to the credits below.

## Credits

| Files | Source | License |
|---|---|---|
| All 22 files in this folder | Vano design team, drawn from simple geometric shapes | Own work |
