# Sakura image assets

Generated with the built-in ImageGen tool, then resized without changing aspect
ratio. Sticker files are 360×360 RGBA PNGs, matching `assets/stamp.png`; the
catalog thumbnail is 720×720.

Shared prompt direction: a centered single cherry tree on a small soil mound,
transparent background, polished flat vector-like game illustration, rounded
friendly shapes, dark outline, warm brown trunk, green leaves and sakura pink,
with no text, number, badge, border or watermark.

Level subjects progress from a two-leaf seedling, to a budded sapling, a medium
tree with scattered blossoms, a large mature flowering tree, and a magnificent
full-bloom tree with a few falling petals.

## `pixel/`

The activity renders from `pixel/`, not from these files. `pixel/` holds the
same art cut down to a 64×64 grid with a 24-colour palette and hard alpha, so
it matches the pixel-art UI when scaled back up with
`image-rendering: pixelated`.

Regenerate the stickers with `tools/pixelize.py` (Pillow): box-downsample,
threshold alpha at 50%, then median-cut quantise. Re-run it whenever the source
art in this directory changes.

`pixel/thumbnail.png` is the exception — **hand-drawn pixel art, not a
generated file.** It carries Thai lettering that no downsample survives, so it
is not derived from `thumbnail.png` here and `pixelize.py` deliberately leaves
it alone. Replace it by editing the art itself; it ships at its authored
1254×1254 and is opaque RGB, since Dreambook renders it full-bleed and it
needs no alpha.
