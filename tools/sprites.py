"""ASCII pixel grids -> inline SVG data URIs, pasted into sakura.css as tokens."""
from urllib.parse import quote

PAL = {
    'K': '#3B2412', 'y': '#F1C232', 'w': '#FFE9A0', 'o': '#C08A1E',
    'B': '#1F4E73', 'b': '#5AA9E0', 'l': '#BFE6FF',
    'G': '#2A3D18', 'g': '#6FA644', 'h': '#9BD35F', 's': '#4E7A2E',
    'D': '#4A2E15', 'd': '#7A5230',
    'P': '#9e3350', 'p': '#E8749A', 'q': '#E8749A', 'w': '#ffd1de',
    'W': '#FFF6E0',
    'a': '#6FA644', 'k': '#5E9138', 't': '#82B953',
    'e': '#7A5230', 'E': '#5E3C20', 'H': '#8F6238',
}

SPRITES = {
    'coin': [
        '..KKKK..',
        '.KyyyyK.',
        'KywyyoyK',
        'KywyyoyK',
        'KywyyoyK',
        'Kyyyyoyk'.replace('k', 'K'),
        '.KooooK.',
        '..KKKK..',
    ],
    'water': [
        '...BB...',
        '..BbbB..',
        '.BblbbB.',
        'BblbbbbB',
        'BblbbbbB',
        'BbbbbbbB',
        '.BbbbbB.',
        '..BBBB..',
    ],
    'sprout': [
        '...GG...',
        '..GhgG.G',
        '.GhggGgG',
        'Ghgg gGG'.replace(' ', 'g'),
        '...GsG..',
        '...GsG..',
        '.DddddD.',
        '.DDDDDD.',
    ],
    'basket': [
        '.KKKKKK.',
        'KpqpqpqK',
        'KWWWWWWK',
        'KdWddWdK',
        'KdWddWdK',
        'KdWddWdK',
        '.KddddK.',
        '..KKKK..',
    ],
    'grass': [
        'aaaaaaaaaaaaaaaa',
        'aaakaaaaaaaataaa',
        'aakkaaataaaataaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaataaaaaakaa',
        'aataaaaaaaaakkaa',
        'aataaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaakaaaa',
        'aataaaaaaakkaaaa',
        'aataaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aakaaaataaaaaaaa',
        'akkaaaataaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
    ],
    'soil': [
        'EEEEEEEE',
        'EHHHHHHE',
        'EHeeeeHE',
        'EHeeeeHE',
        'EHeeeeHE',
        'EHeeeeHE',
        'EHHHHHHE',
        'EEEEEEEE',
    ],
    'petal': [
        '..PP..',
        '.PqqP.',
        'PqwwqP',
        'PqwwqP',
        '.PqqP.',
        '..PP..',
    ],
}


def to_uri(rows):
    n = len(rows[0])
    rects = []
    for y, row in enumerate(rows):
        x = 0
        while x < n:
            c = row[x]
            run = 1
            while x + run < n and row[x + run] == c:
                run += 1
            if c != '.':
                rects.append(f"<path d='M{x} {y}h{run}v1h-{run}z' fill='{PAL[c]}'/>")
            x += run
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {n} {len(rows)}' "
           f"shape-rendering='crispEdges'>{''.join(rects)}</svg>")
    return 'url("data:image/svg+xml,' + quote(svg, safe="=:/'<>? ") + '")'


for name, rows in SPRITES.items():
    print(f"  --px-{name}: {to_uri(rows)};")
