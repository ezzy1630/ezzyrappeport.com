import json, struct, sys
from pathlib import Path
from collections import Counter
import numpy as np

out = Path(sys.argv[1])
ref = Path(sys.argv[2])
raw = (out / "playground-glyphs.glb").read_bytes()
jl = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + jl])
binary = raw[28 + jl :]


def read(i):
    a = g["accessors"][i]
    b = g["bufferViews"][a["bufferView"]]
    d = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a["componentType"]]
    n = {"VEC3": 3, "SCALAR": 1}[a["type"]]
    return np.frombuffer(
        binary,
        dtype=d,
        count=a["count"] * n,
        offset=b.get("byteOffset", 0) + a.get("byteOffset", 0),
    ).reshape(-1, n)


report = {
    "glb_bytes": len(raw),
    "nodes": len(g["nodes"]),
    "meshes": len(g["meshes"]),
    "geometry": [],
}
for mesh in g["meshes"]:
    p = mesh["primitives"][0]
    v = read(p["attributes"]["POSITION"])
    f = read(p["indices"]).reshape(-1, 3)
    vol = float(
        np.einsum("ij,ij->i", v[f[:, 0]], np.cross(v[f[:, 1]], v[f[:, 2]])).sum() / 6
    )
    normals = read(p["attributes"]["NORMAL"])
    face_normals = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    average_normals = normals[f].mean(1)
    alignment = np.einsum("ij,ij->i", face_normals, average_normals)
    assert np.all(alignment > 0), mesh.get("name")
    _, welded = np.unique(v, axis=0, return_inverse=True)
    geometric_faces = welded[f]
    edges = Counter(
        tuple(sorted((int(t[i]), int(t[(i + 1) % 3]))))
        for t in geometric_faces
        for i in range(3)
    )
    bad = sum(n != 2 for n in edges.values())
    assert vol > 0 and bad == 0, (mesh.get("name"), vol, bad)
    report["geometry"].append(
        {
            "name": mesh.get("name"),
            "triangles": len(f),
            "signed_volume": vol,
            "nonmanifold_edges": bad,
            "exported_normals_follow_outward_faces": True,
        }
    )
manifest = json.loads((out / "playground-glyphs.json").read_text())
baseline = json.loads(ref.read_text())
errors = []
for current, original in zip(manifest["glyphs"], baseline["glyphs"]):
    assert current["name"] == original["name"]
    for key in ["position", "scale", "dimensions"]:
        error = float(np.max(abs(np.array(current[key]) - original[key])))
        errors.append(error)
        assert error < 1e-5, (current["name"], key, error)
by_name = {n["name"]: n for n in g["nodes"]}
for original in baseline["glyphs"]:
    n = by_name[original["name"]]
    assert "matrix" not in n
    assert (
        np.max(abs(np.array(n.get("translation", [0, 0, 0])) - original["position"]))
        < 1e-5
    )
    assert np.max(abs(np.array(n.get("scale", [1, 1, 1])) - original["scale"])) < 1e-5
    assert n.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1]
    mesh = g["meshes"][n["mesh"]]["primitives"][0]
    v = read(mesh["attributes"]["POSITION"])
    dimensions = (v.max(0) - v.min(0)) * np.array(n.get("scale", [1, 1, 1]))
    assert np.max(abs(dimensions - original["dimensions"])) < 1e-5
assert report["nodes"] == 13 and report["meshes"] == 8 and len(raw) < 900000
report["visible_triangles"] = manifest["triangles"]
report["max_transform_or_bounds_error"] = max(errors)
report["all_checks_passed"] = True
(out / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
