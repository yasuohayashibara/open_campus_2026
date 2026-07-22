#!/usr/bin/env python3
"""Generate a compact backdrop around an A3 landscape toio course."""

from pathlib import Path
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

DPI = 150
# A3 (420 x 297 mm) plus a 120 mm decorative band on every side.
W_MM, H_MM = 660, 537
BAND_MM = 120
OUT = Path(__file__).resolve().parent
FONT = OUT / "fonts" / "NotoSansJP-VF.otf"


def p(mm):
    return round(mm * DPI / 25.4)


@lru_cache(maxsize=32)
def font(mm, weight):
    result = ImageFont.truetype(str(FONT), p(mm))
    result.set_variation_by_axes([weight])
    return result


def label(draw, x, y, value, size, fill, anchor="mm", weight=700):
    draw.text((p(x), p(y)), value, font=font(size, weight), fill=fill, anchor=anchor)


def line(draw, points, fill, width):
    draw.line([(p(x), p(y)) for x, y in points], fill=fill,
              width=p(width), joint="curve")


def circle(draw, x, y, radius, fill, outline=None, width=1):
    draw.ellipse((p(x-radius), p(y-radius), p(x+radius), p(y+radius)),
                 fill=fill, outline=outline, width=p(width))


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(tuple(p(v) for v in box), radius=p(radius), fill=fill,
                           outline=outline, width=p(width))


def triangle(draw, points, fill):
    draw.polygon([(p(x), p(y)) for x, y in points], fill=fill)


def robot(draw, x, y, scale=1):
    rounded(draw, (x-31*scale, y-25*scale, x+31*scale, y+25*scale),
            9*scale, "#FFFFFF", "#18D9DC", 2*scale)
    line(draw, [(x, y-25*scale), (x, y-39*scale)], "#18D9DC", 2*scale)
    circle(draw, x, y-43*scale, 4*scale, "#FFCD4B")
    circle(draw, x-13*scale, y-3*scale, 5*scale, "#092F3D")
    circle(draw, x+13*scale, y-3*scale, 5*scale, "#092F3D")
    line(draw, [(x-13*scale, y+12*scale), (x, y+17*scale),
                (x+13*scale, y+12*scale)], "#765AF5", 2*scale)


def main():
    image = Image.new("RGB", (p(W_MM), p(H_MM)), "#082F3D")
    draw = ImageDraw.Draw(image)

    # Color blocks are confined to the 120 mm bands around the A3 sheet.
    draw.rectangle((0, p(99), p(W_MM), p(120)), fill="#0B7180")
    draw.rectangle((0, p(417), p(W_MM), p(H_MM)), fill="#0B7180")
    draw.rectangle((0, p(120), p(120), p(417)), fill="#0A4553")
    draw.rectangle((p(540), p(120), p(660), p(417)), fill="#0A4553")

    # Title only: large enough to read from the other side of an exhibit table.
    label(draw, 330, 32, "20分で学ぶAIの進化！", 30, "#FFFFFF", "mm", 900)
    label(draw, 330, 77, "シミュレータで育てる「強化学習」ロボットの知能",
          13.5, "#C7FAF4", "mm", 600)

    # Exact A3 placement area.
    draw.rectangle((p(120), p(120), p(540), p(417)), fill="#FFFFFF",
                   outline="#173E4B", width=p(1.2))
    for x, dx in [(112, 1), (548, -1)]:
        for y, dy in [(112, 1), (425, -1)]:
            line(draw, [(x, y+dy*17), (x, y), (x+dx*17, y)], "#18D9DC", 2)

    # The marks stay outside the toio sheet. Two edge marks define each point:
    # their imaginary crossing is the exact START / GOAL coordinate on the A3.
    start_x, start_y = 120+74.89, 120+200.84
    goal_x, goal_y = 120+368.33, 120+64.48
    start_color, goal_color = "#18D9DC", "#FFCD4B"

    # START: left and bottom edge marks.
    line(draw, [(78,start_y),(108,start_y)], start_color, 4.5)
    triangle(draw, [(119,start_y),(104,start_y-8),(104,start_y+8)], start_color)
    rounded(draw, (14,start_y-31,108,start_y-7), 12, "#0B7180", start_color, 1.5)
    label(draw, 61, start_y-19, "スタート位置", 10, "#FFFFFF", weight=800)
    line(draw, [(start_x,451),(start_x,429)], start_color, 4.5)
    triangle(draw, [(start_x,418),(start_x-8,433),(start_x+8,433)], start_color)
    circle(draw, 62, start_y+16, 5, start_color)

    # GOAL: top and right edge marks.
    line(draw, [(goal_x,91),(goal_x,106)], goal_color, 4.5)
    triangle(draw, [(goal_x,119),(goal_x-8,104),(goal_x+8,104)], goal_color)
    line(draw, [(582,goal_y),(553,goal_y)], goal_color, 4.5)
    triangle(draw, [(541,goal_y),(556,goal_y-8),(556,goal_y+8)], goal_color)
    rounded(draw, (552,126,648,158), 15, "#785D00", goal_color, 1.5)
    label(draw, 600, 142, "ゴール位置", 10, "#FFFFFF", weight=800)
    circle(draw, 600, goal_y+16, 5, goal_color)

    # Left and right decorations: robot, neural nodes and motion arrows.
    robot(draw, 61, 270, .85)
    circle(draw, 34, 154, 13, "#765AF5")
    circle(draw, 91, 178, 7, "#FFCD4B")
    circle(draw, 27, 382, 8, "#FF7A45")
    line(draw, [(19,205),(48,205),(66,223),(101,223)], "#78C9C8", 2)
    line(draw, [(18,340),(46,340),(64,322),(103,322)], "#78C9C8", 2)

    nodes = [(583,171,"#18D9DC"),(626,225,"#765AF5"),
             (579,286,"#FFCD4B"),(626,351,"#FF7A45")]
    for i, (x, y, color) in enumerate(nodes):
        circle(draw, x, y, 13 if i % 2 == 0 else 10, color)
        circle(draw, x, y, 4, "#FFFFFF")
        if i:
            line(draw, [(nodes[i-1][0], nodes[i-1][1]), (x, y)], "#78C9C8", 2)
    line(draw, [(561,367),(591,367),(609,385),(650,385)], "#78C9C8", 2)

    # Bottom band: two short explanations for visitors.
    for x, y, r, color in [(25,475,15,"#765AF5"),(91,512,7,"#18D9DC"),
                            (569,512,9,"#FFCD4B"),(637,477,17,"#18D9DC")]:
        circle(draw, x, y, r, color)
    rounded(draw, (57,437,326,524), 12, "#FFFFFF", "#18D9DC", 2)
    circle(draw, 88, 480, 18, "#18D9DC")
    label(draw, 88, 480, "？", 12, "#FFFFFF", weight=900)
    label(draw, 119, 456, "何をする？", 12, "#0B7180", "lm", 800)
    label(draw, 119, 486, "AIを育て、toioを", 11.5, "#173E4B", "lm", 600)
    label(draw, 119, 510, "ゴールまで走らせる。", 11.5, "#173E4B", "lm", 600)
    rounded(draw, (334,437,603,524), 12, "#FFFFFF", "#765AF5", 2)
    circle(draw, 365, 480, 18, "#765AF5")
    label(draw, 365, 480, "！", 12, "#FFFFFF", weight=900)
    label(draw, 396, 456, "何をめざす？", 12, "#6749D6", "lm", 800)
    label(draw, 396, 486, "ほめ方と環境で、", 11.5, "#173E4B", "lm", 600)
    label(draw, 396, 510, "AIの学び方が変わる。", 11.5, "#173E4B", "lm", 600)

    png = OUT / "reinforcement-learning-a0-backboard.png"
    pdf = OUT / "reinforcement-learning-a0-backboard.pdf"
    image.save(png, dpi=(DPI, DPI), optimize=True)
    image.save(pdf, "PDF", resolution=DPI, quality=95)
    print(f"wrote {png} ({image.width}x{image.height}, {DPI} dpi)")
    print(f"wrote {pdf}")


if __name__ == "__main__":
    main()
