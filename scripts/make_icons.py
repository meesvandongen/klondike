#!/usr/bin/env python3
"""Generate Vista-style solitaire icons for all variants.

Each game gets a 1024×1024 master PNG (downsampled for the various
icon sizes) plus 32×32, 128×128, 256×256, an .ico bundle and an
.icns bundle. The icons mirror the visual idiom of the Windows
Vista / Windows 7 solitaire collection: a saturated felt
background, glossy playing cards arranged in a game-specific
motif, with a soft inner highlight at the top so the icon reads as
a button-like surface at small sizes.
"""
import math
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import icnsutil

ROOT = Path(__file__).resolve().parents[1]
ICON_BASE = ROOT / "src-tauri" / "icons"

# Render at supersampled resolution then downsample for crispness.
SUPER = 2
MASTER_OUT = 512  # final master size

RED = (197, 32, 38, 255)
BLACK = (28, 28, 28, 255)
WHITE = (252, 252, 252, 255)
CARD_BORDER = (40, 40, 40, 255)
CARD_SHADOW = (0, 0, 0, 160)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for name in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(name):
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


# ---------- Background ----------

def felt_background(size: int, hue: str) -> Image.Image:
    """Radial-gradient felt with a soft top highlight, in the Vista
    button style. Drawn directly as an RGBA image."""
    palettes = {
        # bright (centre)        dark (edges)            highlight
        "green":  ((48, 138, 65),  (10, 56, 24),  (170, 220, 180)),
        "blue":   ((52, 99, 175),  (12, 34, 78),  (180, 210, 240)),
        "purple": ((118, 70, 156), (38, 18, 70),  (200, 175, 230)),
        "red":    ((180, 50, 60),  (70, 10, 22),  (240, 180, 190)),
        "amber":  ((194, 132, 36), (82, 44, 12),  (245, 215, 150)),
        "teal":   ((44, 132, 132), (10, 50, 58),  (170, 220, 220)),
    }
    bright, dark, highlight = palettes[hue]
    img = Image.new("RGBA", (size, size), dark + (255,))
    px = img.load()
    cx, cy = size / 2, size * 0.40
    rmax = math.hypot(size, size) * 0.6
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / rmax
            t = min(1.0, d)
            # Mix bright -> dark
            r = int(bright[0] * (1 - t) + dark[0] * t)
            g = int(bright[1] * (1 - t) + dark[1] * t)
            b = int(bright[2] * (1 - t) + dark[2] * t)
            # Top highlight band
            top_t = max(0.0, 1.0 - y / (size * 0.45))
            top_t = top_t ** 2 * 0.18
            r = int(r * (1 - top_t) + highlight[0] * top_t)
            g = int(g * (1 - top_t) + highlight[1] * top_t)
            b = int(b * (1 - top_t) + highlight[2] * top_t)
            px[x, y] = (r, g, b, 255)
    return img


def add_outer_ring(img: Image.Image, color=(0, 0, 0, 160), width=None):
    """Soft dark ring around the icon edge."""
    if width is None:
        width = max(2, img.size[0] // 80)
    s = img.size[0]
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.rounded_rectangle((0, 0, s - 1, s - 1),
                         radius=int(s * 0.18),
                         outline=color, width=width)
    img.alpha_composite(ring)


# ---------- Card primitives ----------

def make_card(w: int, h: int, face_up: bool = True,
              draw_face=None) -> Image.Image:
    """Draw a single card as a separate RGBA image with an alpha drop
    shadow already composited in."""
    pad = int(max(w, h) * 0.22)
    iw, ih = w + 2 * pad, h + 2 * pad
    img = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))

    # --- Drop shadow ---
    sh = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle(
        (pad + int(w * 0.04), pad + int(h * 0.07),
         pad + w - int(w * 0.02), pad + h + int(h * 0.02)),
        radius=int(w * 0.09), fill=CARD_SHADOW,
    )
    sh = sh.filter(ImageFilter.GaussianBlur(int(w * 0.07)))
    img = Image.alpha_composite(img, sh)

    d = ImageDraw.Draw(img)
    radius = int(w * 0.09)
    border_w = max(2, int(w * 0.02))

    if face_up:
        # Card surface with a subtle vertical sheen.
        face = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        fd = ImageDraw.Draw(face)
        for i in range(h):
            t = i / max(1, h - 1)
            c = (
                int(255 * (1 - t * 0.04)),
                int(255 * (1 - t * 0.04)),
                int(252 * (1 - t * 0.05)),
                255,
            )
            fd.line([(0, i), (w, i)], fill=c)
        # Top inner gloss
        gloss = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(gloss)
        for i in range(int(h * 0.45)):
            t = i / max(1, int(h * 0.45) - 1)
            a = int(60 * (1 - t) ** 2)
            gd.line([(0, i), (w, i)], fill=(255, 255, 255, a))
        face = Image.alpha_composite(face, gloss)

        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, w, h), radius=radius, fill=255,
        )
        img.paste(face, (pad, pad), mask)

        # Border
        d.rounded_rectangle(
            (pad, pad, pad + w, pad + h),
            radius=radius, outline=CARD_BORDER, width=border_w,
        )

        if draw_face:
            content = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw_face(content)
            content_mask = Image.new("L", (w, h), 0)
            ImageDraw.Draw(content_mask).rounded_rectangle(
                (0, 0, w, h), radius=radius, fill=255,
            )
            content.putalpha(
                Image.eval(content_mask, lambda v: v).convert("L")
            ) if False else None
            img.paste(content, (pad, pad), content)
    else:
        # Patterned back: blue gradient + cross-hatch.
        back = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(back)
        for i in range(h):
            t = i / max(1, h - 1)
            col = (
                int(40 * (1 - t) + 22 * t),
                int(95 * (1 - t) + 60 * t),
                int(178 * (1 - t) + 118 * t),
                255,
            )
            bd.line([(0, i), (w, i)], fill=col)
        step = max(8, int(w * 0.075))
        for off in range(-h, w + h, step):
            bd.line([(off, 0), (off + h, h)],
                    fill=(255, 255, 255, 55), width=2)
            bd.line([(off + h, 0), (off, h)],
                    fill=(255, 255, 255, 55), width=2)
        # Inner gloss
        gloss = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(gloss)
        for i in range(int(h * 0.40)):
            t = i / max(1, int(h * 0.40) - 1)
            a = int(70 * (1 - t) ** 2)
            gd.line([(0, i), (w, i)], fill=(255, 255, 255, a))
        back = Image.alpha_composite(back, gloss)

        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, w, h), radius=radius, fill=255,
        )
        img.paste(back, (pad, pad), mask)

        d.rounded_rectangle(
            (pad, pad, pad + w, pad + h),
            radius=radius, outline=CARD_BORDER, width=border_w,
        )
        inset = max(4, int(w * 0.08))
        d.rounded_rectangle(
            (pad + inset, pad + inset,
             pad + w - inset, pad + h - inset),
            radius=int(w * 0.06),
            outline=(255, 255, 255, 90),
            width=max(1, int(w * 0.013)),
        )

    return img


def paste_rotated(canvas: Image.Image, card: Image.Image,
                  cx: float, cy: float, angle: float = 0):
    if angle != 0:
        card = card.rotate(angle, resample=Image.BICUBIC, expand=True)
    iw, ih = card.size
    canvas.alpha_composite(card,
                            (int(cx - iw / 2), int(cy - ih / 2)))


# ---------- Suit shapes ----------

def suit_shape(suit: str, size: int, color) -> Image.Image:
    """Render a single suit pip at the given pixel size."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if suit == "H":
        # Two circles forming the bumps, then a triangle below.
        cx = s / 2
        r = s * 0.27
        d.ellipse((s * 0.05, s * 0.07, s * 0.52, s * 0.55),
                  fill=color)
        d.ellipse((s * 0.48, s * 0.07, s * 0.95, s * 0.55),
                  fill=color)
        d.polygon(
            [(s * 0.04, s * 0.38), (s * 0.96, s * 0.38),
             (cx, s * 0.97)],
            fill=color,
        )
    elif suit == "D":
        d.polygon(
            [(s * 0.5, s * 0.03), (s * 0.97, s * 0.5),
             (s * 0.5, s * 0.97), (s * 0.03, s * 0.5)],
            fill=color,
        )
    elif suit == "C":
        r = s * 0.23
        d.ellipse((s * 0.5 - r, s * 0.18 - r,
                   s * 0.5 + r, s * 0.18 + r), fill=color)
        d.ellipse((s * 0.27 - r, s * 0.55 - r,
                   s * 0.27 + r, s * 0.55 + r), fill=color)
        d.ellipse((s * 0.73 - r, s * 0.55 - r,
                   s * 0.73 + r, s * 0.55 + r), fill=color)
        # Stem
        d.polygon(
            [(s * 0.42, s * 0.55), (s * 0.58, s * 0.55),
             (s * 0.70, s * 0.95), (s * 0.30, s * 0.95)],
            fill=color,
        )
    elif suit == "S":
        # Inverted heart + stem.
        cx = s / 2
        d.ellipse((s * 0.05, s * 0.40, s * 0.52, s * 0.88),
                  fill=color)
        d.ellipse((s * 0.48, s * 0.40, s * 0.95, s * 0.88),
                  fill=color)
        d.polygon(
            [(cx, s * 0.03), (s * 0.97, s * 0.62),
             (s * 0.03, s * 0.62)],
            fill=color,
        )
        # Stem
        d.polygon(
            [(s * 0.42, s * 0.78), (s * 0.58, s * 0.78),
             (s * 0.70, s * 0.97), (s * 0.30, s * 0.97)],
            fill=color,
        )
    return img


def card_face_default(face: Image.Image, rank: str, suit: str):
    """Render a corner index + large center pip on the card face."""
    w, h = face.size
    color = RED if suit in ("H", "D") else BLACK
    font = load_font(int(h * 0.18))
    d = ImageDraw.Draw(face)

    # Top-left rank + small suit
    d.text((w * 0.07, h * 0.03), rank, font=font, fill=color)
    small = suit_shape(suit, int(h * 0.13), color)
    face.alpha_composite(small, (int(w * 0.075), int(h * 0.22)))

    # Bottom-right rank + small suit (rotated 180°)
    rank_w = int(w * 0.42)
    rank_h = int(h * 0.4)
    rl = Image.new("RGBA", (rank_w, rank_h), (0, 0, 0, 0))
    ImageDraw.Draw(rl).text((0, 0), rank, font=font, fill=color)
    rl = rl.rotate(180, expand=False)
    face.alpha_composite(rl, (int(w * 0.55), int(h * 0.6)))
    sl = Image.new("RGBA", small.size, (0, 0, 0, 0))
    sl.alpha_composite(small)
    sl = sl.rotate(180, expand=False)
    face.alpha_composite(sl, (int(w * 0.79), int(h * 0.65)))

    # Big center pip
    big = suit_shape(suit, int(h * 0.5), color)
    face.alpha_composite(
        big,
        (int((w - big.size[0]) / 2), int((h - big.size[1]) / 2)),
    )


# ---------- Per-game motifs ----------

def klondike_icon(size: int) -> Image.Image:
    bg = felt_background(size, "green")
    cw, ch = int(size * 0.40), int(size * 0.56)

    # Background fanned cards (face-down) behind a foreground card.
    paste_rotated(bg, make_card(cw, ch, face_up=False),
                  size * 0.32, size * 0.55, angle=14)
    paste_rotated(bg, make_card(cw, ch, face_up=False),
                  size * 0.68, size * 0.55, angle=-14)

    # Foreground: A♠ card
    def face(face_img):
        card_face_default(face_img, "A", "S")
    paste_rotated(bg, make_card(cw, ch, face_up=True, draw_face=face),
                  size * 0.50, size * 0.52, angle=0)

    add_outer_ring(bg)
    return bg


def freecell_icon(size: int) -> Image.Image:
    bg = felt_background(size, "blue")

    # 4 columns of cascade cards behind 4 foundation/cell slots.
    col_w = int(size * 0.16)
    col_h = int(size * 0.26)
    col_gap = int(size * 0.06)
    total_w = 4 * col_w + 3 * col_gap
    start_x = (size - total_w) / 2 + col_w / 2

    # Cells/foundations row (small face-up cards at top).
    cell_y = size * 0.30
    ranks = ["A", "K", "Q", "J"]
    suits = ["S", "H", "D", "C"]
    for i in range(4):
        x = start_x + i * (col_w + col_gap)
        rank = ranks[i]
        suit = suits[i]
        def face(face_img, _r=rank, _s=suit):
            card_face_default(face_img, _r, _s)
        paste_rotated(bg, make_card(col_w, col_h,
                                     face_up=True,
                                     draw_face=face),
                      x, cell_y)

    # Cascade below — 3 cards fanned down per column.
    casc_w = int(size * 0.18)
    casc_h = int(size * 0.28)
    fan_step = int(casc_h * 0.30)
    casc_top = size * 0.50
    for i in range(4):
        x = start_x + i * (col_w + col_gap)
        for j in range(3):
            face_up = (j == 0)
            rank = ["10", "9", "8"][j]
            def face(face_img, _r=rank, _s=suits[i]):
                card_face_default(face_img, _r, _s)
            card = make_card(
                casc_w, casc_h,
                face_up=face_up,
                draw_face=face if face_up else None,
            )
            paste_rotated(bg, card, x, casc_top + j * fan_step)

    add_outer_ring(bg)
    return bg


def spider_icon(size: int) -> Image.Image:
    bg = felt_background(size, "purple")

    # Fan of face-down cards across the lower half.
    cw, ch = int(size * 0.32), int(size * 0.46)
    base_y = size * 0.62
    angles = [-30, -15, 0, 15, 30]
    radius = size * 0.30
    for i, a in enumerate(angles):
        rad = math.radians(a)
        x = size * 0.5 + math.sin(rad) * radius * 0.6
        y = base_y - math.cos(rad) * radius * 0.06
        paste_rotated(bg, make_card(cw, ch, face_up=False),
                      x, y, angle=-a)

    # Big foreground card: K♠ since Spider plays only spades.
    fw, fh = int(size * 0.38), int(size * 0.54)
    def face(face_img):
        card_face_default(face_img, "K", "S")
    paste_rotated(bg, make_card(fw, fh, face_up=True, draw_face=face),
                  size * 0.50, size * 0.46)

    add_outer_ring(bg)
    return bg


def tripeaks_icon(size: int) -> Image.Image:
    bg = felt_background(size, "teal")

    # Three peaks: each peak is 1 + 2 cards, then a shared bottom
    # row spans all three.
    cw, ch = int(size * 0.16), int(size * 0.23)
    half = cw / 2
    peak_centres = [size * 0.24, size * 0.50, size * 0.76]
    peak_top = size * 0.24
    peak_mid = peak_top + ch * 0.55
    peak_bot = peak_top + ch * 1.10
    for cx in peak_centres:
        paste_rotated(bg, make_card(cw, ch, face_up=False), cx, peak_top)
        paste_rotated(bg, make_card(cw, ch, face_up=False), cx - half * 0.9, peak_mid)
        paste_rotated(bg, make_card(cw, ch, face_up=False), cx + half * 0.9, peak_mid)
    # Shared bottom row of 10 cards
    bottom_w = int(size * 0.90)
    n = 10
    spacing = bottom_w / (n - 1)
    start_x = (size - bottom_w) / 2
    for i in range(n):
        x = start_x + i * spacing
        face_up = (i == 4 or i == 5)
        rank = "A" if i == 4 else "K"
        suit = "H" if i == 4 else "C"
        def face(face_img, _r=rank, _s=suit):
            card_face_default(face_img, _r, _s)
        card = make_card(
            cw, ch, face_up=face_up,
            draw_face=face if face_up else None,
        )
        paste_rotated(bg, card, x, peak_bot)

    add_outer_ring(bg)
    return bg


def pyramid_icon(size: int) -> Image.Image:
    bg = felt_background(size, "amber")

    rows = 5
    cw = int(size * 0.16)
    ch = int(size * 0.22)
    row_step = ch * 0.58
    top_y = size * 0.25
    bottom_y = top_y + (rows - 1) * row_step
    _ = bottom_y  # for future use
    for row in range(rows):
        n = row + 1
        y = top_y + row * row_step
        total_w = n * cw - (n - 1) * (cw * 0.10)
        start_x = (size - total_w) / 2 + cw / 2
        for c in range(n):
            x = start_x + c * (cw - cw * 0.10)
            # Mark the apex card face-up (A♥).
            face_up = (row == 0)
            rank = "A"
            suit = "H"
            def face(face_img, _r=rank, _s=suit):
                card_face_default(face_img, _r, _s)
            paste_rotated(
                bg,
                make_card(cw, ch, face_up=face_up,
                          draw_face=face if face_up else None),
                x, y,
            )

    add_outer_ring(bg)
    return bg


def hearts_icon(size: int) -> Image.Image:
    """Big red heart, prominent — the canonical Vista Hearts icon."""
    bg = felt_background(size, "red")

    # Soft white "card" backdrop behind the heart.
    cw, ch = int(size * 0.62), int(size * 0.78)
    card_img = make_card(cw, ch, face_up=True)
    paste_rotated(bg, card_img, size * 0.5, size * 0.52)

    # Big bold heart on the card.
    heart_size = int(size * 0.50)
    heart = suit_shape("H", heart_size, RED)
    # Subtle inner highlight on top-left for depth. Composite via
    # the heart's own alpha mask so the highlight never spills
    # outside the heart shape.
    highlight = Image.new("RGBA", heart.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse(
        (heart_size * 0.16, heart_size * 0.10,
         heart_size * 0.46, heart_size * 0.30),
        fill=(255, 255, 255, 130),
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(heart_size * 0.02))
    heart.alpha_composite(highlight)

    bg.alpha_composite(
        heart,
        (int((size - heart_size) / 2),
         int((size - heart_size) / 2) - int(size * 0.02)),
    )

    add_outer_ring(bg)
    return bg


GAMES = {
    "klondike": klondike_icon,
    "freecell": freecell_icon,
    "spider":   spider_icon,
    "tripeaks": tripeaks_icon,
    "pyramid":  pyramid_icon,
    "hearts":   hearts_icon,
}


def write_set(name: str, master_super: Image.Image) -> None:
    out = ICON_BASE / name
    out.mkdir(parents=True, exist_ok=True)
    master = master_super.resize(
        (MASTER_OUT, MASTER_OUT), Image.LANCZOS,
    )
    master.save(out / "icon.png")
    master.resize((32, 32), Image.LANCZOS).save(out / "32x32.png")
    master.resize((128, 128), Image.LANCZOS).save(out / "128x128.png")
    master.resize((256, 256), Image.LANCZOS).save(out / "128x128@2x.png")

    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)]
    master.save(out / "icon.ico", format="ICO", sizes=ico_sizes)

    builder = icnsutil.IcnsFile()
    sizes = {
        "ic07": 128,
        "ic08": 256,
        "ic09": 512,
        "ic10": 1024,
        "ic12": 64,
        "ic13": 256,
        "ic14": 512,
    }
    tmp_dir = out / "_icns_tmp"
    tmp_dir.mkdir(exist_ok=True)
    try:
        for key, sz in sizes.items():
            tmp = tmp_dir / f"{key}.png"
            master_super.resize((sz, sz), Image.LANCZOS).save(tmp)
            builder.add_media(key, file=str(tmp))
        builder.write(str(out / "icon.icns"))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main() -> None:
    base_size = MASTER_OUT * SUPER
    for name, fn in GAMES.items():
        print(f"Generating {name} icon set...")
        write_set(name, fn(base_size))
    print("Done.")


if __name__ == "__main__":
    main()
