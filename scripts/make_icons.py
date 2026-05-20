#!/usr/bin/env python3
"""Generate Vista-style solitaire icons for all variants.

Each game gets a 512×512 master PNG plus 32×32, 128×128, 128×128@2x
(=256), an .ico bundle, and an .icns bundle. The icons mirror the
visual idiom of the Windows Vista / Windows 7 solitaire collection:
glossy playing cards arranged in a game-specific motif, on a colored
felt background.
"""
import math
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import icnsutil

ROOT = Path(__file__).resolve().parents[1]
ICON_BASE = ROOT / "src-tauri" / "icons"

RED = (197, 32, 38, 255)
BLACK = (28, 28, 28, 255)
WHITE = (252, 252, 252, 255)
CARD_BORDER = (40, 40, 40, 255)
CARD_SHADOW = (0, 0, 0, 140)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for name in [
        "/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(name):
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def felt_background(size: int, hue: str) -> Image.Image:
    """Radial-gradient felt background tinted by `hue`."""
    palettes = {
        "green":  ((48, 138, 65),  (12, 64, 28)),
        "blue":   ((52, 99, 175),  (16, 38, 86)),
        "purple": ((118, 70, 156), (44, 22, 78)),
        "red":    ((180, 50, 60),  (78, 14, 22)),
        "amber":  ((194, 132, 36), (90, 50, 14)),
        "teal":   ((44, 132, 132), (12, 56, 64)),
    }
    bright, dark = palettes[hue]
    img = Image.new("RGBA", (size, size), dark + (255,))
    px = img.load()
    cx, cy = size / 2, size * 0.42
    rmax = math.hypot(size, size)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / rmax
            t = min(1.0, d * 1.6)
            r = int(bright[0] * (1 - t) + dark[0] * t)
            g = int(bright[1] * (1 - t) + dark[1] * t)
            b = int(bright[2] * (1 - t) + dark[2] * t)
            px[x, y] = (r, g, b, 255)
    return img


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill,
                            outline=outline, width=width)


def draw_card(canvas: Image.Image, x: float, y: float, w: float, h: float,
              rotate: float = 0.0, face_up: bool = True,
              content_draw=None) -> None:
    """Render a card onto `canvas` with optional rotation. content_draw
    is a callable(card_image) drawing the face artwork in the card's
    own coordinate space (the card image is `w` × `h`)."""
    pad = int(max(w, h) * 0.18)
    layer_w = int(w + pad * 2)
    layer_h = int(h + pad * 2)
    layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    shadow = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (pad + 4, pad + 8, pad + w - 2, pad + h),
        radius=int(w * 0.08), fill=CARD_SHADOW,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(w * 0.06)))
    layer = Image.alpha_composite(layer, shadow)
    d = ImageDraw.Draw(layer)

    if face_up:
        rounded_rect(
            d, (pad, pad, pad + w, pad + h),
            radius=int(w * 0.08), fill=WHITE,
            outline=CARD_BORDER, width=max(2, int(w * 0.018)),
        )
        if content_draw:
            face = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))
            content_draw(face)
            layer.alpha_composite(face, (pad, pad))
    else:
        # Patterned back: blue gradient + cross-hatch.
        back = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))
        bd = ImageDraw.Draw(back)
        # gradient
        for i in range(int(h)):
            t = i / max(1, h - 1)
            col = (
                int(45 * (1 - t) + 25 * t),
                int(95 * (1 - t) + 60 * t),
                int(170 * (1 - t) + 120 * t),
                255,
            )
            bd.line([(0, i), (int(w), i)], fill=col)
        # crosshatch
        step = max(6, int(w * 0.07))
        for off in range(-int(w), int(w + h), step):
            bd.line(
                [(off, 0), (off + int(h), int(h))],
                fill=(255, 255, 255, 40), width=1,
            )
            bd.line(
                [(off + int(h), 0), (off, int(h))],
                fill=(255, 255, 255, 40), width=1,
            )
        mask = Image.new("L", (int(w), int(h)), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle(
            (0, 0, int(w), int(h)),
            radius=int(w * 0.08), fill=255,
        )
        layer.paste(back, (pad, pad), mask)
        rounded_rect(
            d, (pad, pad, pad + w, pad + h),
            radius=int(w * 0.08), fill=None,
            outline=CARD_BORDER, width=max(2, int(w * 0.018)),
        )
        inset = max(4, int(w * 0.07))
        rounded_rect(
            d, (pad + inset, pad + inset,
                pad + w - inset, pad + h - inset),
            radius=int(w * 0.06), fill=None,
            outline=(255, 255, 255, 70),
            width=max(1, int(w * 0.012)),
        )

    if rotate != 0:
        layer = layer.rotate(
            rotate, resample=Image.BICUBIC, expand=False,
        )

    canvas.alpha_composite(
        layer, (int(x - layer_w / 2), int(y - layer_h / 2))
    )


SUIT_PATHS = {
    "S": "spade",
    "H": "heart",
    "D": "diamond",
    "C": "club",
}


def suit_image(suit: str, size: int, color) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size

    if suit == "H":
        # Two circles + triangle, rounded heart shape.
        cx = s / 2
        r = s * 0.27
        d.ellipse((s * 0.10, s * 0.10, s * 0.50, s * 0.55), fill=color)
        d.ellipse((s * 0.50, s * 0.10, s * 0.90, s * 0.55), fill=color)
        d.polygon(
            [(s * 0.06, s * 0.40), (s * 0.94, s * 0.40), (cx, s * 0.97)],
            fill=color,
        )
    elif suit == "D":
        d.polygon(
            [(s * 0.5, s * 0.06), (s * 0.93, s * 0.5),
             (s * 0.5, s * 0.94), (s * 0.07, s * 0.5)],
            fill=color,
        )
    elif suit == "C":
        r = s * 0.22
        d.ellipse((s * 0.50 - r, s * 0.16 - r,
                   s * 0.50 + r, s * 0.16 + r), fill=color)
        d.ellipse((s * 0.30 - r, s * 0.50 - r,
                   s * 0.30 + r, s * 0.50 + r), fill=color)
        d.ellipse((s * 0.70 - r, s * 0.50 - r,
                   s * 0.70 + r, s * 0.50 + r), fill=color)
        # Stem
        d.polygon(
            [(s * 0.40, s * 0.55), (s * 0.60, s * 0.55),
             (s * 0.66, s * 0.92), (s * 0.34, s * 0.92)],
            fill=color,
        )
    elif suit == "S":
        # Spade = inverted heart + stem
        cx = s / 2
        d.ellipse((s * 0.07, s * 0.43, s * 0.50, s * 0.93), fill=color)
        d.ellipse((s * 0.50, s * 0.43, s * 0.93, s * 0.93), fill=color)
        d.polygon(
            [(cx, s * 0.06), (s * 0.95, s * 0.65), (s * 0.05, s * 0.65)],
            fill=color,
        )
        d.polygon(
            [(s * 0.40, s * 0.80), (s * 0.60, s * 0.80),
             (s * 0.68, s * 0.97), (s * 0.32, s * 0.97)],
            fill=color,
        )
    return img


def card_face(face: Image.Image, rank: str, suit: str) -> None:
    """Render a corner index + small center pip on the face image."""
    w, h = face.size
    color = RED if suit in ("H", "D") else BLACK
    font_r = load_font(int(h * 0.16))
    d = ImageDraw.Draw(face)

    # Top-left rank
    d.text((w * 0.07, h * 0.04), rank, font=font_r, fill=color)
    # Top-left suit (small)
    pip_small = suit_image(suit, int(h * 0.13), color)
    face.alpha_composite(pip_small, (int(w * 0.08), int(h * 0.21)))

    # Bottom-right rank rotated 180
    rank_layer = Image.new("RGBA", (int(w * 0.4), int(h * 0.4)), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rank_layer)
    rd.text((0, 0), rank, font=font_r, fill=color)
    rank_layer = rank_layer.rotate(180, expand=False)
    face.alpha_composite(
        rank_layer,
        (int(w * 0.62), int(h * 0.58)),
    )
    # Bottom-right small suit
    pip_layer = Image.new("RGBA", pip_small.size, (0, 0, 0, 0))
    pip_layer.alpha_composite(pip_small)
    pip_layer = pip_layer.rotate(180, expand=False)
    face.alpha_composite(
        pip_layer,
        (int(w * 0.78), int(h * 0.67)),
    )

    # Big center pip.
    big = suit_image(suit, int(h * 0.5), color)
    face.alpha_composite(
        big, (int((w - big.size[0]) / 2), int((h - big.size[1]) / 2)),
    )


# ---------- Per-game motifs ----------

def klondike_icon(size: int) -> Image.Image:
    bg = felt_background(size, "green")
    cw, ch = size * 0.46, size * 0.62
    cx, cy = size * 0.5, size * 0.55
    # Three cards spread.
    specs = [
        (cx - cw * 0.55, cy + 6, -16, "10", "C"),
        (cx,             cy,     0,   "A", "S"),
        (cx + cw * 0.55, cy + 6, 16,  "K", "H"),
    ]
    for x, y, rot, rank, suit in specs:
        def make_face(face, _rank=rank, _suit=suit):
            card_face(face, _rank, _suit)
        draw_card(bg, x, y, cw, ch, rotate=rot,
                  content_draw=make_face)
    return bg


def freecell_icon(size: int) -> Image.Image:
    bg = felt_background(size, "blue")
    cw, ch = size * 0.34, size * 0.46
    pad_x = size * 0.06
    total_w = 4 * cw + 3 * pad_x
    start_x = (size - total_w) / 2 + cw / 2
    y_top = size * 0.30
    suits = ["S", "H", "D", "C"]
    ranks = ["A", "K", "Q", "J"]
    for i in range(4):
        x = start_x + i * (cw + pad_x)
        def make_face(face, _s=suits[i], _r=ranks[i]):
            card_face(face, _r, _s)
        draw_card(bg, x, y_top, cw, ch, rotate=-2 + i,
                  content_draw=make_face)
        draw_card(bg, x, y_top + ch * 0.55, cw, ch, face_up=False,
                  rotate=-2 + i)
    return bg


def spider_icon(size: int) -> Image.Image:
    bg = felt_background(size, "purple")
    cw, ch = size * 0.42, size * 0.58
    cy = size * 0.62
    # 5-card spread of face-down + 1 face-up.
    for i in range(5):
        x = size * (0.22 + i * 0.14)
        rot = -18 + i * 9
        draw_card(bg, x, cy + abs(i - 2) * 6, cw, ch,
                  rotate=rot, face_up=False)
    # Foreground spade card
    def make_face(face):
        card_face(face, "K", "S")
    draw_card(bg, size * 0.5, cy * 0.92, cw * 1.05, ch * 1.05,
              content_draw=make_face)
    return bg


def tripeaks_icon(size: int) -> Image.Image:
    bg = felt_background(size, "teal")
    cw, ch = size * 0.20, size * 0.28
    # Three peaks of face-down cards with a single face-up keystone.
    centers = [size * 0.22, size * 0.50, size * 0.78]
    for cx in centers:
        # 3-row peak: 1 + 2 + 3 (top to bottom).
        # Top
        draw_card(bg, cx, size * 0.22, cw, ch, face_up=False)
        # Mid
        draw_card(bg, cx - cw * 0.45, size * 0.38, cw, ch, face_up=False)
        draw_card(bg, cx + cw * 0.45, size * 0.38, cw, ch, face_up=False)
        # Base
        draw_card(bg, cx - cw * 0.92, size * 0.54, cw, ch, face_up=False)
        draw_card(bg, cx,             size * 0.54, cw, ch, face_up=False)
        draw_card(bg, cx + cw * 0.92, size * 0.54, cw, ch, face_up=False)
    # Foreground key card on bottom row
    def make_face(face):
        card_face(face, "A", "H")
    draw_card(bg, size * 0.5, size * 0.80,
              cw * 1.4, ch * 1.4, content_draw=make_face)
    return bg


def pyramid_icon(size: int) -> Image.Image:
    bg = felt_background(size, "amber")
    cw, ch = size * 0.17, size * 0.24
    base_y = size * 0.78
    rows = 5
    for row in range(rows):
        y = base_y - row * ch * 0.62
        n = rows - row
        total_w = n * cw + (n - 1) * (cw * 0.07)
        start_x = (size - total_w) / 2 + cw / 2
        for c in range(n):
            x = start_x + c * (cw + cw * 0.07)
            face_up = (row == rows - 1 and c == n // 2)
            def make_face(face):
                card_face(face, "A", "H")
            draw_card(bg, x, y, cw, ch, face_up=face_up,
                      content_draw=make_face if face_up else None)
    return bg


def hearts_icon(size: int) -> Image.Image:
    bg = felt_background(size, "red")
    cw, ch = size * 0.46, size * 0.64
    cx, cy = size * 0.5, size * 0.5
    # Background card (Q of spades).
    def qs_face(face):
        card_face(face, "Q", "S")
    draw_card(bg, cx - cw * 0.20, cy + 10, cw, ch,
              rotate=-12, content_draw=qs_face)
    # Front card (Heart Q).
    def qh_face(face):
        card_face(face, "Q", "H")
    draw_card(bg, cx + cw * 0.10, cy, cw, ch,
              rotate=8, content_draw=qh_face)
    return bg


GAMES = {
    "klondike": klondike_icon,
    "freecell": freecell_icon,
    "spider":   spider_icon,
    "tripeaks": tripeaks_icon,
    "pyramid":  pyramid_icon,
    "hearts":   hearts_icon,
}


def write_set(name: str, master: Image.Image) -> None:
    out = ICON_BASE / name
    out.mkdir(parents=True, exist_ok=True)
    master.save(out / "icon.png")
    master.resize((32, 32), Image.LANCZOS).save(out / "32x32.png")
    master.resize((128, 128), Image.LANCZOS).save(out / "128x128.png")
    master.resize((256, 256), Image.LANCZOS).save(out / "128x128@2x.png")

    # Multi-size ICO.
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)]
    master.save(out / "icon.ico", format="ICO", sizes=ico_sizes)

    # ICNS via icnsutil.
    builder = icnsutil.IcnsFile()
    sizes = {
        "ic07": 128,    # 128×128
        "ic08": 256,    # 256×256
        "ic09": 512,    # 512×512
        "ic10": 1024,   # 1024×1024 retina 512
        "ic12": 64,     # 32×32 @2x
        "ic13": 256,    # 128×128 @2x
        "ic14": 512,    # 256×256 @2x
    }
    tmp_dir = out / "_icns_tmp"
    tmp_dir.mkdir(exist_ok=True)
    try:
        for key, sz in sizes.items():
            tmp = tmp_dir / f"{key}.png"
            if sz <= 512:
                master.resize((sz, sz), Image.LANCZOS).save(tmp)
            else:
                # Upscale via LANCZOS — fine for icons.
                master.resize((sz, sz), Image.LANCZOS).save(tmp)
            builder.add_media(key, file=str(tmp))
        builder.write(str(out / "icon.icns"))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main() -> None:
    SIZE = 512
    for name, fn in GAMES.items():
        print(f"Generating {name} icon set...")
        write_set(name, fn(SIZE))
    print("Done.")


if __name__ == "__main__":
    main()
