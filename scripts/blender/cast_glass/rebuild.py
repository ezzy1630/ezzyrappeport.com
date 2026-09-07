"""Rebuild closed, outward-normal, continuous cast glass glyphs.
Requires system Python numpy scipy pillow scikit-image and Blender 4.5+.
python rebuild.py --blender /path/to/blender --source /path/to/polished-glyphs.blend --output /path/to/output --water /path/to/water.webp --baseline /path/to/playground-glyphs.json
"""

import argparse, subprocess, sys
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--blender", required=True)
p.add_argument("--source", required=True)
p.add_argument("--output", required=True)
p.add_argument("--water", required=True)
p.add_argument("--baseline", required=True)
a = p.parse_args()
out = Path(a.output).resolve()
out.mkdir(parents=True, exist_ok=True)
scripts = Path(__file__).resolve().parent


def blender(script, *args):
    subprocess.run(
        [
            a.blender,
            "-b",
            "--threads",
            "8",
            "--python-exit-code",
            "1",
            "--python",
            str(scripts / script),
            "--",
            *map(str, args),
        ],
        check=True,
    )


blender("extract.py", a.source, out)
subprocess.run([sys.executable, str(scripts / "remodel.py"), str(out)], check=True)
blender("refine_optics.py", a.source, out, a.water)
blender("render_round.py", out)
blender("last_optics.py", out)
blender("export_final.py", out / "last-optics.blend", out)
subprocess.run(
    [sys.executable, str(scripts / "validate_glb.py"), str(out), a.baseline], check=True
)
from PIL import Image, ImageOps

blender("fresnel_poster.py", out)
blender("render_fresnel_final.py", out)
poster = Image.open(out / "fresnel-title-final.png")
poster.save(out / "fresnel-title-final.webp", quality=94, method=6)
proof = ImageOps.fit(Image.open(a.water).convert("RGBA"), poster.size)
proof.alpha_composite(poster)
proof.convert("RGB").save(out / "proof.jpg", quality=95)
