"""生成项目图标：和风圆环 + 斜向刀光，纯自绘、无第三方素材。

用法：python scripts/make-icon.py
生成 build/icon.png（256x256），electron-builder 会用它做 exe 图标。
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "build" / "icon.png"
SIZE = 256

img = Image.new("RGBA", (SIZE, SIZE), (8, 11, 13, 255))
d = ImageDraw.Draw(img)

# 圆底
d.ellipse((12, 12, 244, 244), fill=(18, 48, 38, 255))
# 双层圆环
d.ellipse((18, 18, 238, 238), outline=(46, 213, 150, 255), width=7)
d.ellipse((36, 36, 220, 220), outline=(78, 148, 118, 255), width=2)
# 斜向刀光
d.polygon([(56, 200), (200, 56), (200, 88), (88, 200)], fill=(244, 255, 249, 255))
# 中心点
d.ellipse((120, 120, 136, 136), fill=(46, 213, 150, 255))

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print("icon written:", OUT)
