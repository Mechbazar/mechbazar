"""Generates every MechBazar logo asset from one source of truth.

The logo is the wordmark "MECHBAZAR" -- "MECH" in brand ink, "BAZAR" in brand
red, set as one unbroken word so the colour change is what marks the split.

The letterforms are baked to SVG *paths* rather than rendered as text with a
`fontFamily`. That matters: a text-rendered wordmark silently reflows into
Roboto on Android, San Francisco on iOS and whatever the browser picks on web,
so the "same" logo came out three different shapes. Paths render identically
everywhere and need no font bundled or loaded at runtime.

Run from the repo root (needs no network):

    pip install fonttools pillow
    python tools/brand/generate-logo.py

Outputs, into every app's asset directory (see TARGETS):
  - logo-wordmark.svg / -dark.svg    horizontal, for light / dark surfaces
  - logo-wordmark.png @1x @2x @3x    rasters, both tones
  - logo-stacked.svg / .png          square lock-up for icon-shaped slots
It also rewrites packages/shared/src/brand/logoPaths.ts, which is what the
shared <Logo/> component draws.
"""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Arial Black: the heavy neo-grotesque whose weight and proportions match the
# brand wordmark. Only the outlines of these nine letters are used -- the font
# itself is never bundled or shipped.
FONT_PATH = "C:/Windows/Fonts/ariblk.ttf"

WORD_INK = "MECH"
WORD_RED = "BAZAR"

# Brand colours, deliberately the existing shared-theme tokens rather than new
# ones: ink is theme colors.text, red is theme colors.primary. Fixed here (and
# in the generated TS) so the logo cannot shift with an individual app's
# palette -- apps/admin and apps/vendor set primary-500 to a far darker
# #db0000, which is why the old text-based wordmarks looked like a different
# logo in each panel.
INK = "#1C2430"
RED = "#DA3830"
ON_DARK_INK = "#FFFFFF"

# Extra space between letters, as a fraction of the em. The reference wordmark
# is tracked just wide enough that the heavy strokes don't collide.
TRACKING = 0.02

# All geometry is normalised to a 1000-unit em so the exported numbers are
# readable and independent of the source font's unitsPerEm.
EM = 1000.0


@dataclass
class Word:
    """One colour's worth of letters, as a single SVG path plus its ink bounds."""

    path: str
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    end_x: float  # pen position after the last letter, for laying out the next word

    @property
    def width(self) -> float:
        return self.max_x - self.min_x

    @property
    def height(self) -> float:
        return self.max_y - self.min_y


def layout_word(font: TTFont, word: str, start_x: float) -> Word:
    """Sets `word` starting at `start_x`, in Y-down SVG coordinates.

    The glyph outlines come out of the font Y-up from the baseline, so the
    transform flips Y and drops the origin to the cap line -- that puts the top
    of the capitals near y=0 and makes the resulting box easy to reason about.
    """
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = EM / font["head"].unitsPerEm
    cap_height = font["OS/2"].sCapHeight * scale
    tracking = TRACKING * EM

    commands: list[str] = []
    bounds = BoundsPen(glyphs)
    x = start_x

    for ch in word:
        glyph = glyphs[cmap[ord(ch)]]
        # Y-down flip: negative y-scale, origin lifted to the cap line.
        transform = Transform(scale, 0, 0, -scale, x, cap_height)

        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}")
        glyph.draw(TransformPen(pen, transform))
        commands.append(pen.getCommands())

        glyph.draw(TransformPen(bounds, transform))
        x += glyph.width * scale + tracking

    # Drop the trailing tracking: it is space *between* letters, not after the
    # last one, and leaving it in would pad the viewBox on the right.
    end_x = x - tracking
    min_x, min_y, max_x, max_y = bounds.bounds
    return Word(" ".join(commands), min_x, min_y, max_x, max_y, end_x)


def wordmark_svg(ink_word: Word, red_word: Word, ink: str) -> str:
    """Horizontal lock-up. The viewBox carries the offset, so the paths are
    emitted exactly as generated and stay byte-identical to the TS export."""
    min_x = min(ink_word.min_x, red_word.min_x)
    min_y = min(ink_word.min_y, red_word.min_y)
    w = max(ink_word.max_x, red_word.max_x) - min_x
    h = max(ink_word.max_y, red_word.max_y) - min_y
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{min_x:.1f} {min_y:.1f} {w:.1f} {h:.1f}" '
        f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="MechBazar">\n'
        f'  <path fill="{ink}" d="{ink_word.path}"/>\n'
        f'  <path fill="{RED}" d="{red_word.path}"/>\n'
        f"</svg>\n"
    )


def stacked_svg(ink_word: Word, red_word: Word, ink: str) -> str:
    """Square lock-up -- MECH over BAZAR -- for icon and avatar slots, where a
    wide wordmark would have to shrink until it was unreadable."""
    # Each line is measured by its own inked height, not a uniform line height:
    # the round C in MECH overshoots the cap line while BAZAR is all flat
    # letters, so reserving one height for both would leave the block sitting
    # visibly low in the square.
    gap = max(ink_word.height, red_word.height) * 0.30
    content_w = max(ink_word.width, red_word.width)
    content_h = ink_word.height + gap + red_word.height
    pad = content_w * 0.10
    side = max(content_w, content_h) + pad * 2

    y = (side - content_h) / 2
    rows = []
    for word, colour in ((ink_word, ink), (red_word, RED)):
        # Each word is re-centred from its own bounds back to the box origin.
        dx = (side - word.width) / 2 - word.min_x
        rows.append(
            f'  <g transform="translate({dx:.1f} {y - word.min_y:.1f})">'
            f'<path fill="{colour}" d="{word.path}"/></g>'
        )
        y += word.height + gap
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side:.0f} {side:.0f}" '
        f'width="{side:.0f}" height="{side:.0f}" role="img" aria-label="MechBazar">\n'
        + "\n".join(rows)
        + "\n</svg>\n"
    )


# Rasters are drawn at this multiple of the target size and downsampled, which
# is where the antialiasing comes from.
SUPERSAMPLE = 4


def _draw_word(word: str, size: int, colour: str) -> Image.Image:
    """Renders one word with Pillow, cropped to its inked pixels.

    Pillow has no SVG rasteriser, and hand-flattening the outlines would mean
    reimplementing even-odd fill for the counters in A, B and R. Drawing text
    from the same font at the same tracking gives the same shapes for free --
    these PNGs and the SVG paths are the same letterforms by construction.
    """
    font = ImageFont.truetype(FONT_PATH, size)
    tracking = TRACKING * size
    ascent, descent = font.getmetrics()

    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    advance = sum(probe.textlength(ch, font=font) + tracking for ch in word)

    img = Image.new("RGBA", (int(advance) + size, ascent + descent), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 0.0
    for ch in word:
        # Per-character so the tracking is applied between letters; drawing the
        # whole string at once would use the font's own spacing.
        d.text((x, ascent), ch, font=font, fill=colour, anchor="ls")
        x += probe.textlength(ch, font=font) + tracking
    return img


def _trim(img: Image.Image) -> Image.Image:
    """Crops to the inked pixels so the PNG carries no baked-in padding --
    callers control their own spacing, and the aspect then matches the SVG."""
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img


def rasterize_wordmark(height_px: int, ink: str) -> Image.Image:
    """Horizontal lock-up. Both words are drawn onto one canvas so they share a
    baseline -- trimming them separately would misalign them, because the round
    C in MECH overshoots the cap line and the letters in BAZAR are all flat."""
    size = height_px * SUPERSAMPLE
    font = ImageFont.truetype(FONT_PATH, size)
    tracking = TRACKING * size
    ascent, descent = font.getmetrics()

    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    total = sum(probe.textlength(ch, font=font) + tracking for ch in WORD_INK + WORD_RED)

    img = Image.new("RGBA", (int(total) + size, ascent + descent), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 0.0
    for word, colour in ((WORD_INK, ink), (WORD_RED, RED)):
        for ch in word:
            d.text((x, ascent), ch, font=font, fill=colour, anchor="ls")
            x += probe.textlength(ch, font=font) + tracking

    trimmed = _trim(img)
    return trimmed.resize(
        (max(1, trimmed.width // SUPERSAMPLE), max(1, trimmed.height // SUPERSAMPLE)),
        Image.LANCZOS,
    )


def rasterize_stacked(side_px: int, ink: str) -> Image.Image:
    """Square lock-up -- MECH over BAZAR -- for icon and avatar slots, where a
    wide wordmark would have to shrink until it was unreadable.

    Each line is composited from its own tightly-cropped bitmap, so both are
    optically centred on their ink rather than on their advance width (which
    includes side bearings). Mirrors the geometry in stacked_svg().
    """
    size = side_px * SUPERSAMPLE // 3  # cap height ~= a third of the square
    lines = [_trim(_draw_word(WORD_INK, size, ink)), _trim(_draw_word(WORD_RED, size, RED))]

    gap = int(max(line.height for line in lines) * 0.30)
    content_w = max(line.width for line in lines)
    content_h = sum(line.height for line in lines) + gap
    pad = int(content_w * 0.10)
    side = max(content_w, content_h) + pad * 2

    img = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    y = (side - content_h) // 2
    for line in lines:
        img.alpha_composite(line, ((side - line.width) // 2, y))
        y += line.height + gap

    return img.resize((side_px, side_px), Image.LANCZOS)


def logo_paths_ts(ink_word: Word, red_word: Word) -> str:
    min_x = min(ink_word.min_x, red_word.min_x)
    min_y = min(ink_word.min_y, red_word.min_y)
    w = max(ink_word.max_x, red_word.max_x) - min_x
    h = max(ink_word.max_y, red_word.max_y) - min_y
    return f'''// GENERATED FILE -- do not edit by hand.
// Regenerate with: python tools/brand/generate-logo.py
//
// The MechBazar wordmark as vector outlines. Baked to paths so the logo is the
// same shape on Android, iOS and web instead of reflowing into whatever heavy
// sans each platform happens to have.

/** viewBox of the horizontal wordmark. Carries an offset -- do not assume "0 0". */
export const WORDMARK_VIEW_BOX = '{min_x:.1f} {min_y:.1f} {w:.1f} {h:.1f}';
/** Width-to-height ratio: callers set one dimension and derive the other. */
export const WORDMARK_ASPECT = {w / h:.4f};

/** Outline of "MECH". Filled with the ink colour (white on dark surfaces). */
export const MECH_PATH =
  '{ink_word.path}';

/** Outline of "BAZAR". Always brand red, on every background. */
export const BAZAR_PATH =
  '{red_word.path}';

/**
 * Canonical logo colours. Intentionally fixed rather than read from each app's
 * palette: apps/admin and apps/vendor define primary-500 as a much darker red,
 * which is what made the old text-based wordmarks differ panel to panel.
 */
export const LOGO_COLORS = {{
  /** "MECH" on light surfaces. Matches theme colors.text. */
  ink: '{INK}',
  /** "MECH" on dark surfaces. */
  inkOnDark: '{ON_DARK_INK}',
  /** "BAZAR", unchanged across themes. Matches theme colors.primary. */
  red: '{RED}',
}} as const;
'''


# Expo apps: assets/ is what require() and app.json/app.config.js resolve against.
EXPO_TARGETS = [
    "apps/mobile/assets",
    "apps/mechanic/assets",
    "apps/rider/assets",
    "apps/seller-mobile/assets",
    "apps/admin-mobile/assets",
]

# Vite panels: public/ is served from the site root.
WEB_TARGETS = [
    "apps/admin/public",
    "apps/vendor/public",
]

# Deliberately NOT generated here: icon.png and the android-icon-* set. Those
# are the launcher icons, and they intentionally carry a different mark per app
# over each app's own brand colour so the five installed apps stay
# distinguishable on a home screen -- a shared wordmark would make all five
# identical. See the adaptiveIcon comment in apps/mobile/app.config.js.


def main() -> None:
    font = TTFont(FONT_PATH)
    ink_word = layout_word(font, WORD_INK, 0.0)
    red_word = layout_word(font, WORD_RED, ink_word.end_x + TRACKING * EM)

    total_w = max(ink_word.max_x, red_word.max_x) - min(ink_word.min_x, red_word.min_x)
    total_h = max(ink_word.max_y, red_word.max_y) - min(ink_word.min_y, red_word.min_y)
    print(f"wordmark {total_w:.1f} x {total_h:.1f} (aspect {total_w / total_h:.3f})")

    build = os.path.join(REPO, "tools", "brand", "build")
    os.makedirs(build, exist_ok=True)

    svgs = {
        "logo-wordmark.svg": wordmark_svg(ink_word, red_word, INK),
        "logo-wordmark-dark.svg": wordmark_svg(ink_word, red_word, ON_DARK_INK),
        "logo-stacked.svg": stacked_svg(ink_word, red_word, INK),
        "logo-stacked-dark.svg": stacked_svg(ink_word, red_word, ON_DARK_INK),
    }
    for name, body in svgs.items():
        with open(os.path.join(build, name), "w", encoding="utf-8") as fh:
            fh.write(body)

    # 1x is sized for the largest on-screen use (the welcome screens); Metro
    # picks @2x/@3x on higher-density devices.
    for suffix, mult in (("", 1), ("@2x", 2), ("@3x", 3)):
        for tone, ink in (("", INK), ("-dark", ON_DARK_INK)):
            rasterize_wordmark(64 * mult, ink).save(
                os.path.join(build, f"logo-wordmark{tone}{suffix}.png")
            )
            rasterize_stacked(192 * mult, ink).save(
                os.path.join(build, f"logo-stacked{tone}{suffix}.png")
            )

    # Splash art. Two files because expo-splash-screen composites one image over
    # a light background and another over the dark one -- a single ink wordmark
    # would be invisible on the dark splash. Wide enough to stay sharp at the
    # configured imageWidth on a 3x screen.
    splash_light = rasterize_wordmark(128, INK)
    splash_dark = rasterize_wordmark(128, ON_DARK_INK)
    splash_light.save(os.path.join(build, "splash-icon.png"))
    splash_dark.save(os.path.join(build, "splash-icon-dark.png"))

    # Web favicon: the stacked lock-up, since a 9:1 wordmark is unreadable in a
    # browser tab. Flattened onto white because favicon.png has no alpha.
    favicon = Image.new("RGB", (256, 256), "#FFFFFF")
    stacked_png = rasterize_stacked(256, INK)
    favicon.paste(stacked_png, (0, 0), stacked_png)
    favicon.save(os.path.join(build, "favicon.png"))

    # The Vite panels take an SVG favicon, so they get the vector lock-up.
    shutil.copyfile(
        os.path.join(build, "logo-stacked.svg"), os.path.join(build, "favicon.svg")
    )

    # Only the files something actually loads get copied into an app. The UI
    # draws the logo from the vector paths in logoPaths.ts, not from these
    # rasters, so shipping the full export set into every app would be dead
    # weight -- and apps/mobile sets assetBundlePatterns: ['**/*'], which would
    # bundle every stray file straight into the APK. The complete export set
    # (both tones, both lock-ups, @1-3x) stays in tools/brand/build/ for design
    # handoff and one-off uses.
    for target in EXPO_TARGETS:
        dest = os.path.join(REPO, target)
        os.makedirs(dest, exist_ok=True)
        for name in ("splash-icon.png", "splash-icon-dark.png", "favicon.png"):
            shutil.copyfile(os.path.join(build, name), os.path.join(dest, name))
        print("copied ->", target)

    for target in WEB_TARGETS:
        dest = os.path.join(REPO, target)
        os.makedirs(dest, exist_ok=True)
        for name in ("favicon.svg",):
            shutil.copyfile(os.path.join(build, name), os.path.join(dest, name))
        print("copied ->", target)

    brand_dir = os.path.join(REPO, "packages", "shared", "src", "brand")
    os.makedirs(brand_dir, exist_ok=True)
    with open(os.path.join(brand_dir, "logoPaths.ts"), "w", encoding="utf-8") as fh:
        fh.write(logo_paths_ts(ink_word, red_word))
    print("wrote packages/shared/src/brand/logoPaths.ts")


if __name__ == "__main__":
    main()
