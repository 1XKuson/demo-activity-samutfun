# tools

Build-time helpers for the Sakura Garden pixel art. Neither runs at page load,
and neither is needed unless the art changes. Both want Pillow:

```sh
python3 -m venv .venv && .venv/bin/pip install pillow
```

- `pixelize.py` — cuts `assets/sakura/*.png` down to `assets/sakura/pixel/`.
  Run from the repo root: `.venv/bin/python tools/pixelize.py`
- `sprites.py` — turns the ASCII grids at the top of the file into the
  `--px-*` inline-SVG tokens in `sakura.css`. Prints the CSS lines; paste them
  over the matching lines in the `:root` block.
