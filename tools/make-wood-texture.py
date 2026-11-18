# Sinh texture mặt bàn gỗ (ván thông nhuộm màu óc chó đậm), lặp liền mạch theo cả hai chiều.
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(7)
W, H, PLANK = 1536, 768, 256          # 4 tấm ván mỗi ô lặp
x = np.arange(W)[None, :].astype(float)
y = np.arange(H)[:, None].astype(float)

def periodic_noise(octaves):
    out = np.zeros((H, W))
    for fx, fy, amp in octaves:
        for _ in range(3):
            kx = rng.integers(1, fx + 1); ky = rng.integers(0, fy + 1)
            ph = rng.uniform(0, 2 * np.pi)
            out += amp * np.sin(2 * np.pi * (kx * x / W + ky * y / H) + ph)
    return out

img = np.zeros((H, W, 3))
base = np.array([0.15, 0.095, 0.06])      # nâu óc chó
light = np.array([0.40, 0.27, 0.15])
for p in range(H // PLANK):
    y0 = p * PLANK
    sl = slice(y0, y0 + PLANK)
    yy = y[sl] - y0
    warp = periodic_noise([(1, 0, 6), (3, 1, 2.5), (9, 2, 0.8)])[sl]
    # vân gỗ: các đường gần song song chạy dọc tấm ván, bị uốn bởi warp
    t = (yy + warp) * rng.uniform(0.09, 0.14)
    grain = 0.5 + 0.5 * np.sin(t + 1.7 * np.sin(t * 0.37))
    grain = grain ** 3
    # vân lớn (vòng năm) mờ hơn
    arch = rng.uniform(15, 45) * np.cos(2 * np.pi * (x - rng.uniform(0, W)) / W)
    phase = (yy + warp + arch) * rng.uniform(0.045, 0.065) + rng.uniform(0, 6)
    rings = 0.6 * (0.5 + 0.5 * np.sin(phase)) ** 4 + 0.4 * (0.5 + 0.5 * np.sin(phase * 2.3 + 1)) ** 8
    # sớ gỗ: nhiễu kéo dài theo chiều ván (vệt ngang mảnh)
    cols = W // 32
    raw = rng.normal(0, 1, (PLANK, cols))
    xi = np.arange(W) / 32
    i0 = np.floor(xi).astype(int) % cols; i1 = (i0 + 1) % cols; fr = xi - np.floor(xi)
    fr = fr * fr * (3 - 2 * fr)
    streak = raw[:, i0] * (1 - fr) + raw[:, i1] * fr
    streak = np.cumsum(streak * 0.0 + rng.normal(0, 1, (PLANK, 1)), axis=0) * 0 + streak
    fine = 0.05 * streak + 0.03 * rng.normal(0, 1, (PLANK, W))
    # mắt gỗ
    knot = np.zeros((PLANK, W))
    for _ in range(rng.integers(0, 3)):
        kx, ky = rng.uniform(0, W), rng.uniform(40, PLANK - 40)
        dx = np.minimum(np.abs(x - kx), W - np.abs(x - kx)); dy = yy - ky
        r = np.sqrt((dx / 2.2) ** 2 + dy ** 2)
        knot += np.exp(-r / 14) * (0.6 + 0.4 * np.sin(r * 0.6))
    v = 0.12 * grain + 0.38 * rings + fine - 0.45 * np.clip(knot, 0, 1)
    tone = rng.uniform(-0.05, 0.05)
    v = np.clip(v + tone + 0.12, 0, 1)
    col = base[None, None, :] + (light - base)[None, None, :] * v[..., None]
    # mép ván: khe tối + vát sáng nhẹ
    edge = np.ones((PLANK, 1))
    edge[:3] = 0.25; edge[3:6] = 1.12; edge[-3:] = 0.55
    col *= edge[..., None]
    img[sl] = col
img = np.clip(img, 0, 1)
im = Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
im.save('wood.jpg', quality=82, optimize=True, progressive=True)
# xem thử khi lặp 2x2
prev = Image.new('RGB', (W * 2, H * 2))
for i in range(2):
    for j in range(2): prev.paste(im, (i * W, j * H))
prev.resize((W, H)).save('preview.jpg')
