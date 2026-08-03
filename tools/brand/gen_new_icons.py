from PIL import Image
import os

# Source art: AI-generated flat "app icon tile" renders supplied by the user
# 2026-07-31 (already-rounded square, black background baked in, full color,
# no alpha channel). Archived under tools/brand/sources/ for provenance -- do
# not delete; re-run this script from them if an asset needs regenerating.
APPS = {
    'rider': {
        'src': 'tools/brand/sources/rider-icon-source.jpg',
        'assets': 'apps/rider/assets',
    },
    'mechanic': {
        'src': 'tools/brand/sources/mechanic-icon-source.jpg',
        'assets': 'apps/mechanic/assets',
    },
}

BG_RGBA = (0x0b, 0x0b, 0x0b, 255)

# Piecewise-linear luminance -> alpha lookup table (256 entries), built once.
LOW, HIGH = 22, 70
LUT = []
for lum in range(256):
    if lum <= LOW:
        a = 0
    elif lum >= HIGH:
        a = 255
    else:
        a = round(255 * (lum - LOW) / (HIGH - LOW))
    LUT.append(a)

for app, cfg in APPS.items():
    src = Image.open(cfg['src']).convert('RGB')
    assets = cfg['assets']

    # 1. icon.png -- legacy launcher / iOS / Play Store base, full-bleed, untouched artwork.
    icon = src.resize((1024, 1024), Image.LANCZOS).convert('RGBA')
    icon.save(os.path.join(assets, 'icon.png'))

    # 2. favicon.png -- small web favicon, same crop, matches previous 196x196.
    favicon = src.resize((196, 196), Image.LANCZOS).convert('RGBA')
    favicon.save(os.path.join(assets, 'favicon.png'))

    # 3. android-icon-foreground.png -- adaptive icon foreground layer. Full-bleed,
    #    same artwork, upgraded to 1024 (previous mark-based version was 512;
    #    the source resolution now supports higher quality with no upscale blur).
    fg = src.resize((1024, 1024), Image.LANCZOS).convert('RGBA')
    fg.save(os.path.join(assets, 'android-icon-foreground.png'))

    # 4. android-icon-background.png -- solid near-black fill sampled from the
    #    artwork's own background, so any mask-shape crop on Android 8+ reveals
    #    matching black rather than a seam or a different app's old brand color.
    bg = Image.new('RGBA', (1024, 1024), BG_RGBA)
    bg.save(os.path.join(assets, 'android-icon-background.png'))

    # 5. android-icon-monochrome.png -- Android 13+ themed-icon derivative.
    #    NOT part of the primary artwork; a required single-tone silhouette
    #    derived by luminance threshold (background -> transparent, character
    #    art -> opaque white). Built via a LUT + point()/putalpha, not a
    #    per-pixel Python loop.
    src_big = src.resize((1024, 1024), Image.LANCZOS)
    luminance = src_big.convert('L')
    alpha = luminance.point(LUT)
    mono = Image.new('RGBA', (1024, 1024), (255, 255, 255, 255))
    mono.putalpha(alpha)
    mono.save(os.path.join(assets, 'android-icon-monochrome.png'))

    # 6. Play Store listing deliverable -- explicit 1024x1024 copy for submission.
    play = src.resize((1024, 1024), Image.LANCZOS)
    os.makedirs('tools/brand/output', exist_ok=True)
    play.save('tools/brand/output/%s-playstore-1024.png' % app)

    print(app, 'done')
