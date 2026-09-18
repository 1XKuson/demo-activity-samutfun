"""Bake the smooth sticker art down to hard-edged pixel art.

Box-downsample to a small grid, hard-threshold alpha so edges stay crisp,
then quantise to a small palette. `--bake` nearest-upscales the result so the
file itself carries the blocks, for places we cannot set image-rendering.
"""
import sys
from PIL import Image

def pixelize(src, dst, grid, colors, bake=None):
    im = Image.open(src).convert("RGBA").resize((grid, grid), Image.BOX)
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v >= 128 else 0)
    flat = Image.merge("RGB", (r, g, b)).quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
    out = Image.merge("RGBA", (*flat.split(), a))
    if bake:
        out = out.resize((bake, bake), Image.NEAREST)
    out.save(dst)
    return out.size

if __name__ == "__main__":
    for n in range(1, 6):
        print(n, pixelize(f"assets/sakura/sticker-level-{n}.png",
                          f"assets/sakura/pixel/sticker-level-{n}.png", 64, 24))
    print("thumb", pixelize("assets/sakura/thumbnail.png",
                            "assets/sakura/pixel/thumbnail.png", 90, 32, bake=720))
