from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter
from skimage.measure import marching_cubes

out = Path(sys.argv[1])
for name in "EZYRAPOT":
    src = np.load(out / (name + ".npz"))
    v = src["vertices"]
    faces = src["faces"]
    lo = v.min(0)
    hi = v.max(0)
    step = 0.0025
    pad = 12
    w, h = np.ceil((hi - lo)[:2] / step).astype(int) + 2 * pad + 1
    im = Image.new("L", (int(w), int(h)))
    draw = ImageDraw.Draw(im)
    xy = (v[:, :2] - lo[:2]) / step + pad
    for f in faces:
        draw.polygon([tuple(xy[i]) for i in f], fill=255)
    mask = np.array(im) > 127
    signed = (distance_transform_edt(mask) - distance_transform_edt(~mask)) * step
    signed = gaussian_filter(signed, 0.9)
    d = np.maximum(signed, 0)
    radius = np.max(d) * 1.05
    # Continuous ellipse profile removes inherited triangulation ripples and hard planar caps.
    half = (hi[2] - lo[2]) / 2
    zheight = half * np.sqrt(np.maximum(0, 1 - np.maximum(0, 1 - d / radius) ** 2))
    z = np.arange(-half - step * 4, half + step * 5, step)
    field = np.minimum(
        signed[:, :, None], zheight[:, :, None] - abs(z)[None, None, :]
    ).astype(np.float32)
    verts, tris, _, _ = marching_cubes(field, 0, spacing=(step, step, step))
    verts = verts[:, [1, 0, 2]]
    verts[:, :2] += lo[:2] - pad * step
    verts[:, 2] += z[0] + (hi[2] + lo[2]) / 2
    np.savez(out / (name + "-round.npz"), vertices=verts, faces=tris, lo=lo, hi=hi)
    print(name, len(tris))
