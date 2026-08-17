#!/usr/bin/env python3
"""Generate src/favicon.ico -- a subClassOf fork in the Synapse palette.

    python3 util/favicon/make-favicon.py [--preview]

The .ico is committed; it is generated rather than hand-drawn so its colours stay
tied to the palette the app's chrome uses (the --sage-* tokens in
src/app/css/toolstyle.css). Change a colour here, re-run, commit the result.

Design constraints, in order of importance:

1. It has to read at 16x16, which is the only size most users ever see. That
   rules out fine detail, and it rules out text -- at 16px a letterform in a
   coloured square is indistinguishable from every other letterform in a
   coloured square.
2. It has to sit on both light and dark browser chrome, so the background is
   opaque rather than transparent.
3. It should say "ontology", so: one parent node forking to two children, which
   is the shape of the class hierarchy this app is for.

Three candidate geometries were rendered and compared at true 16px -- a hub with
three spokes, a triangle of three connected nodes, and this fork. The hub loses
its edges entirely once the node circles are large enough to see; the triangle
collapses towards a solid blob. Keep --preview honest if you change the geometry:
it magnifies the *downsampled* 16x16 raster with nearest-neighbour, because
re-rendering the artwork at 128px tells you nothing about how it survives the
reduction.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Synapse palette, matching toolstyle.css.
BLUE = (57, 89, 121)      # #395979 primary   -- background
GREEN = (70, 146, 133)    # #469285 secondary -- parent node
INK = (255, 255, 255)     # edges and child nodes

SIZES = [16, 32, 48, 64, 128, 256]
SS = 16                   # supersample factor: drawing straight at 16px is ragged
MASTER = 256 * SS

ROOT = Path(__file__).resolve().parents[2]
ICO = ROOT / "src" / "favicon.ico"
PREVIEW = Path(__file__).resolve().parent / "preview.png"


def render(size):
    """The master artwork in a `size`x`size` box. Geometry is in 1/256 units."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = size / 256.0

    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=48 * u, fill=BLUE)

    # Sized to leave ~3px of background on every side at 16px. A larger glyph
    # looked better magnified but ran its child nodes into the bottom corners
    # once actually reduced.
    cx = cy = size / 2
    parent = (cx, cy - 60 * u)
    children = [(cx - 53 * u, cy + 56 * u), (cx + 53 * u, cy + 56 * u)]

    # Edges first, so the nodes cap them.
    for child in children:
        d.line([parent, child], fill=INK, width=int(round(14 * u)))

    def dot(point, r, fill):
        x, y = point
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    dot(parent, 30 * u, GREEN)
    for child in children:
        dot(child, 26 * u, INK)

    return img


def frames():
    master = render(MASTER)
    return [master.resize((s, s), Image.LANCZOS) for s in SIZES]


def main():
    icons = frames()
    icons[-1].save(ICO, format="ICO", sizes=[(s, s) for s in SIZES])
    print(f"wrote {ICO.relative_to(ROOT)} ({ICO.stat().st_size} bytes, "
          f"sizes {', '.join(str(s) for s in SIZES)})")

    if "--preview" in sys.argv:
        by_size = dict(zip(SIZES, icons))
        pad, zoom = 10, 8
        big = by_size[16].convert("RGB").resize((16 * zoom, 16 * zoom), Image.NEAREST)
        w = big.width + pad * 3 + 32
        strip = Image.new("RGB", (w, big.height + pad * 2), (245, 245, 245))
        strip.paste(big, (pad, pad))
        y = pad
        for s in (16, 32):
            strip.paste(by_size[s].convert("RGB"), (big.width + pad * 2, y))
            y += s + pad
        strip.save(PREVIEW)
        print(f"wrote {PREVIEW.relative_to(ROOT)} (16px magnified, plus 16 and 32 actual size)")


if __name__ == "__main__":
    main()
