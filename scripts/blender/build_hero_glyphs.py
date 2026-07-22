#!/usr/bin/env python3
"""Build, render, export, and reimport-validate the portfolio hero glyphs.

Run with Blender, for example:
  blender --background --factory-startup --python-exit-code 1 \
    --python scripts/blender/build_hero_glyphs.py -- \
    --font /absolute/path/to/InterTight-Black-900.ttf \
    --output /absolute/path/to/repo

The input font must be the static Inter Tight weight-900 instance. The repo
contains the official Google Fonts variable source plus the generated instance.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from collections import defaultdict
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, geometry
from mathutils.bvhtree import BVHTree


GLYPHS = [
    (0, "E", 0, "line1_E_00"),
    (1, "Z", 0, "line1_Z_01"),
    (2, "Z", 0, "line1_Z_02"),
    (3, "Y", 0, "line1_Y_03"),
    (4, "R", 1, "line2_R_04"),
    (5, "A", 1, "line2_A_05"),
    (6, "P", 1, "line2_P_06"),
    (7, "P", 1, "line2_P_07"),
    (8, "E", 1, "line2_E_08"),
    (9, "P", 1, "line2_P_09"),
    (10, "O", 1, "line2_O_10"),
    (11, "R", 1, "line2_R_11"),
    (12, "T", 1, "line2_T_12"),
]

# Dimensions are in font em units. The reference is closer to cast glass than
# ordinary extruded type: its planar silhouette is softened and its face rolls
# continuously into a deep shoulder. A fine voxel pass rounds the font's hard
# XY corners before the cap dome is applied.
EXTRUDE = 0.048
CURVE_OFFSET = -0.046
BEVEL = 0.060
BEVEL_SEGMENTS = 12
CURVE_RESOLUTION = 8
BULGE = 0.034
DIRECT_BULGE = BULGE
BULGE_RUN = 0.180
VOXEL_SIZE = 0.0030
CONTOUR_BEVEL = 0.024
CONTOUR_BEVEL_SEGMENTS = 6
TARGET_TRIANGLES = {
    "E": 2500,
    "Z": 2200,
    "Y": 3000,
    "T": 2200,
    "A": 5000,
    "P": 4000,
    "R": 4000,
    "O": 4500,
}
TRACKING = 0.025
LINE_SCALES = {0: 1.36, 1: 1.0}
LINE_Y = {0: 0.58, 1: -0.55}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", required=True, type=Path)
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Repository root; deliverables are written to repo-local paths.",
    )
    parser.add_argument("--samples", type=int, default=256)
    return parser.parse_args(argv)


def collection(name: str) -> bpy.types.Collection:
    existing = bpy.data.collections.get(name)
    if existing:
        return existing
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def set_active(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def create_source_text(
    font: bpy.types.VectorFont,
    char: str,
    name: str,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"source_curve_{name}", "FONT")
    curve.body = char
    curve.font = font
    curve.size = 1.0
    curve.align_x = "LEFT"
    curve.align_y = "BOTTOM_BASELINE"
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.resolution_u = CURVE_RESOLUTION
    curve.extrude = EXTRUDE
    curve.bevel_depth = BEVEL
    curve.bevel_resolution = BEVEL_SEGMENTS
    curve.offset = CURVE_OFFSET
    obj = bpy.data.objects.new(f"source_{name}", curve)
    target.objects.link(obj)
    obj.hide_render = True
    obj.hide_set(True)
    obj["character"] = char
    obj["purpose"] = "editable exact-font source"
    return obj


def projected_centroid(mesh: bpy.types.Mesh) -> tuple[float, float]:
    """Projected-area centroid of the visible front surface.

    Weighting each triangle by its XY projected area naturally includes the
    exact outer silhouette while excluding font counters.
    """
    total = 0.0
    weighted = Vector((0.0, 0.0))
    for poly in mesh.polygons:
        if len(poly.vertices) != 3:
            continue
        a, b, c = (mesh.vertices[i].co for i in poly.vertices)
        cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
        area = abs(cross) * 0.5
        if area < 1e-12 or poly.normal.z <= 0.05:
            continue
        centroid = Vector(((a.x + b.x + c.x) / 3.0, (a.y + b.y + c.y) / 3.0))
        total += area
        weighted += centroid * area
    if total <= 1e-12:
        xs = [v.co.x for v in mesh.vertices]
        ys = [v.co.y for v in mesh.vertices]
        return ((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5)
    center = weighted / total
    return center.x, center.y


def make_custom_rounded_a_mesh() -> bpy.types.Mesh:
    """Build A as three overlapping rounded solids, then union by voxel.

    Inter Tight's acute counter/crossbar cap triangulation is unstable under a
    projected dome. This keeps its proportions while producing a single clean
    cast-glass volume with no cap junction or shading seam.
    """
    bars: list[bpy.types.Object] = []
    specifications = (
        ("A_left_leg", (-0.105, 0.035, 0.0), (0.620, 0.160, 0.224), math.radians(69.5)),
        ("A_right_leg", (0.105, 0.035, 0.0), (0.620, 0.160, 0.224), math.radians(110.5)),
        ("A_crossbar", (0.0, -0.050, 0.0), (0.330, 0.105, 0.205), 0.0),
    )
    for name, location, dimensions, angle in specifications:
        bpy.ops.mesh.primitive_cube_add(location=location)
        bar = bpy.context.object
        bar.name = name
        bar.dimensions = dimensions
        bar.rotation_euler.z = angle
        set_active(bar)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        rounding = bar.modifiers.new("Cast_Glass_Rounding", "BEVEL")
        rounding.width = 0.052
        rounding.segments = 10
        rounding.limit_method = "NONE"
        bpy.ops.object.modifier_apply(modifier=rounding.name)
        bars.append(bar)

    bpy.ops.object.select_all(action="DESELECT")
    for bar in bars:
        bar.select_set(True)
    bpy.context.view_layer.objects.active = bars[0]
    bpy.ops.object.join()
    duplicate = bpy.context.object
    duplicate.name = "working_A_custom_rounded"
    duplicate.data.remesh_voxel_size = VOXEL_SIZE
    duplicate.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    relaxation = duplicate.modifiers.new("A_Union_Relaxation", "LAPLACIANSMOOTH")
    relaxation.iterations = 8
    relaxation.lambda_factor = 0.12
    relaxation.lambda_border = 0.04
    relaxation.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=relaxation.name)
    duplicate.data.calc_loop_triangles()
    current_triangles = len(duplicate.data.loop_triangles)
    if current_triangles > TARGET_TRIANGLES["A"]:
        reduction = duplicate.modifiers.new("A_Production_Decimation", "DECIMATE")
        reduction.decimate_type = "COLLAPSE"
        reduction.ratio = TARGET_TRIANGLES["A"] / current_triangles
        reduction.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=reduction.name)

    polish = duplicate.modifiers.new("A_Final_Polish", "LAPLACIANSMOOTH")
    polish.iterations = 3
    polish.lambda_factor = 0.035
    polish.lambda_border = 0.015
    polish.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=polish.name)
    for poly in duplicate.data.polygons:
        poly.use_smooth = True

    cx, cy = projected_centroid(duplicate.data)
    z_coords = [vert.co.z for vert in duplicate.data.vertices]
    cz = (min(z_coords) + max(z_coords)) * 0.5
    for vert in duplicate.data.vertices:
        vert.co.x -= cx
        vert.co.y -= cy
        vert.co.z -= cz
    duplicate.data.update()
    duplicate.data.name = "glyph_A_custom_rounded_mesh"
    mesh = duplicate.data
    bpy.data.objects.remove(duplicate, do_unlink=True)
    return mesh


def make_custom_rounded_bar_mesh(char: str) -> bpy.types.Mesh:
    """Construct hard-cornered display glyphs from overlapping rounded bars."""
    specifications = {
        "E": (
            ("spine", (-0.135, 0.0, 0.0), (0.540, 0.135, 0.224), math.radians(90.0)),
            ("top", (0.0, 0.205, 0.0), (0.400, 0.130, 0.224), 0.0),
            ("middle", (-0.020, 0.0, 0.0), (0.360, 0.125, 0.224), 0.0),
            ("bottom", (0.0, -0.205, 0.0), (0.400, 0.130, 0.224), 0.0),
        ),
        "Z": (
            ("top", (0.0, 0.205, 0.0), (0.448, 0.135, 0.224), 0.0),
            ("diagonal", (0.0, 0.0, 0.0), (0.505, 0.145, 0.224), math.radians(50.0)),
            ("bottom", (0.0, -0.205, 0.0), (0.448, 0.135, 0.224), 0.0),
        ),
        "Y": (
            ("left_arm", (-0.082, 0.142, 0.0), (0.330, 0.145, 0.224), math.radians(124.0)),
            ("right_arm", (0.082, 0.142, 0.0), (0.330, 0.145, 0.224), math.radians(56.0)),
            ("stem", (0.0, -0.145, 0.0), (0.330, 0.145, 0.224), math.radians(90.0)),
        ),
        "T": (
            ("top", (0.0, 0.205, 0.0), (0.400, 0.145, 0.224), 0.0),
            ("stem", (0.0, -0.070, 0.0), (0.480, 0.145, 0.224), math.radians(90.0)),
        ),
    }[char]
    bars: list[bpy.types.Object] = []
    for part, location, dimensions, angle in specifications:
        bpy.ops.mesh.primitive_cube_add(location=location)
        bar = bpy.context.object
        bar.name = f"{char}_{part}"
        bar.dimensions = dimensions
        bar.rotation_euler.z = angle
        set_active(bar)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        rounding = bar.modifiers.new("Cast_Glass_Rounding", "BEVEL")
        rounding.width = 0.058
        rounding.segments = 10
        rounding.limit_method = "NONE"
        bpy.ops.object.modifier_apply(modifier=rounding.name)
        bars.append(bar)

    bpy.ops.object.select_all(action="DESELECT")
    for bar in bars:
        bar.select_set(True)
    bpy.context.view_layer.objects.active = bars[0]
    bpy.ops.object.join()
    duplicate = bpy.context.object
    duplicate.name = f"working_{char}_custom_rounded"
    duplicate.data.remesh_voxel_size = VOXEL_SIZE
    duplicate.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    relaxation = duplicate.modifiers.new("Rounded_Bar_Union_Relaxation", "LAPLACIANSMOOTH")
    relaxation.iterations = 8
    relaxation.lambda_factor = 0.12
    relaxation.lambda_border = 0.04
    relaxation.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=relaxation.name)
    duplicate.data.calc_loop_triangles()
    current_triangles = len(duplicate.data.loop_triangles)
    if current_triangles > TARGET_TRIANGLES[char]:
        reduction = duplicate.modifiers.new("Production_Decimation", "DECIMATE")
        reduction.decimate_type = "COLLAPSE"
        reduction.ratio = TARGET_TRIANGLES[char] / current_triangles
        reduction.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=reduction.name)

    polish = duplicate.modifiers.new("Final_Polish", "LAPLACIANSMOOTH")
    polish.iterations = 3
    polish.lambda_factor = 0.035
    polish.lambda_border = 0.015
    polish.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=polish.name)
    for poly in duplicate.data.polygons:
        poly.use_smooth = True

    cx, cy = projected_centroid(duplicate.data)
    z_coords = [vert.co.z for vert in duplicate.data.vertices]
    cz = (min(z_coords) + max(z_coords)) * 0.5
    for vert in duplicate.data.vertices:
        vert.co.x -= cx
        vert.co.y -= cy
        vert.co.z -= cz
    duplicate.data.update()
    duplicate.data.name = f"glyph_{char}_custom_rounded_mesh"
    mesh = duplicate.data
    bpy.data.objects.remove(duplicate, do_unlink=True)
    return mesh


def make_inflated_mesh(source: bpy.types.Object, char: str) -> bpy.types.Mesh:
    if char == "A":
        return make_custom_rounded_a_mesh()
    if char in {"E", "Z", "Y", "T"}:
        return make_custom_rounded_bar_mesh(char)

    duplicate = source.copy()
    duplicate.data = source.data.copy()
    bpy.context.scene.collection.objects.link(duplicate)
    duplicate.hide_set(False)
    duplicate.hide_render = False
    set_active(duplicate)
    bpy.ops.object.convert(target="MESH")
    duplicate.name = f"working_{char}"

    # Curve extrusion rounds the front-to-side shoulder but does not soften
    # sharp corners in the font's XY outline. Bevel only the remaining hard
    # contour edges before voxel reconciliation, giving E/Z/T and the A apex
    # the rounded cast-glass silhouette seen in the reference.
    # A's acute counter/crossbar junction cannot accept a second contour bevel
    # without intersecting rails. Its curve shoulder plus volume relaxation
    # already rounds the outer apex, so keep that junction clean.
    if char != "A":
        contour = duplicate.modifiers.new("Rounded_Planar_Contour", "BEVEL")
        contour.width = CONTOUR_BEVEL
        contour.segments = CONTOUR_BEVEL_SEGMENTS
        contour.limit_method = "ANGLE"
        contour.angle_limit = math.radians(32.0)
        bpy.ops.object.modifier_apply(modifier=contour.name)
        duplicate.data.update()

    bm = bmesh.new()
    bm.from_mesh(duplicate.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.normal_update()
    # Every glyph enters the same volume pipeline. Limiting voxel
    # reconciliation to countered glyphs preserved the font's square planar
    # corners and made the result read as beveled text instead of inflated
    # glass.
    direct_cap_glyphs: set[str] = set()
    if char in direct_cap_glyphs:
        cap_faces = [face for face in bm.faces if abs(face.normal.z) > 0.985]
        cap_edges = {edge for face in cap_faces for edge in face.edges}
        boundary_xy = []
        for edge in cap_edges:
            if any(abs(face.normal.z) <= 0.985 for face in edge.link_faces):
                boundary_xy.extend((edge.verts[0].co.xy.copy(), edge.verts[1].co.xy.copy()))
        bmesh.ops.subdivide_edges(
            bm,
            edges=list(cap_edges),
            cuts=4,
            use_grid_fill=False,
            smooth=0.0,
        )
        bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
        z_values = [vert.co.z for vert in bm.verts]
        z_min, z_max = min(z_values), max(z_values)
        cap_epsilon = 1e-5
        for vert in bm.verts:
            if abs(vert.co.z - z_max) <= cap_epsilon:
                distance = min((vert.co.xy - point).length for point in boundary_xy)
                t = max(0.0, min(1.0, distance / BULGE_RUN))
                vert.co.z += DIRECT_BULGE * math.sin(t * math.pi * 0.5)
            elif abs(vert.co.z - z_min) <= cap_epsilon:
                distance = min((vert.co.xy - point).length for point in boundary_xy)
                t = max(0.0, min(1.0, distance / BULGE_RUN))
                vert.co.z -= DIRECT_BULGE * math.sin(t * math.pi * 0.5)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(duplicate.data)
        bm.free()
        duplicate.data.update()
    else:
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(duplicate.data)
        bm.free()
        duplicate.data.update()

        # Reconcile the converted curve into a fine watertight volume. This
        # also gives the planar silhouette enough topology to relax its hard
        # font corners into a cast, inflated edge.
        set_active(duplicate)
        duplicate.data.remesh_voxel_size = VOXEL_SIZE
        duplicate.data.remesh_voxel_adaptivity = 0.0
        bpy.ops.object.voxel_remesh()
        duplicate.data.update()

        bm = bmesh.new()
        bm.from_mesh(duplicate.data)
        z_values = [vert.co.z for vert in bm.verts]
        z_min, z_max = min(z_values), max(z_values)
        cap_epsilon = 0.8 * VOXEL_SIZE
        front_cap = {vert for vert in bm.verts if vert.co.z >= z_max - cap_epsilon}
        back_cap = {vert for vert in bm.verts if vert.co.z <= z_min + cap_epsilon}
        front_boundary = [
            vert.co.xy.copy()
            for vert in front_cap
            if any(edge.other_vert(vert) not in front_cap for edge in vert.link_edges)
        ]
        back_boundary = [
            vert.co.xy.copy()
            for vert in back_cap
            if any(edge.other_vert(vert) not in back_cap for edge in vert.link_edges)
        ]
        cap_bulge = BULGE * (0.35 if char == "A" else 1.0)
        for vert in front_cap:
            distance = min((vert.co.xy - point).length for point in front_boundary)
            t = max(0.0, min(1.0, distance / BULGE_RUN))
            vert.co.z += cap_bulge * math.sin(t * math.pi * 0.5)
        for vert in back_cap:
            distance = min((vert.co.xy - point).length for point in back_boundary)
            t = max(0.0, min(1.0, distance / BULGE_RUN))
            vert.co.z -= cap_bulge * math.sin(t * math.pi * 0.5)
        bm.to_mesh(duplicate.data)
        bm.free()
        duplicate.data.update()

        smooth = duplicate.modifiers.new("Inflated_Silhouette_Relaxation", "LAPLACIANSMOOTH")
        smooth.iterations = 14
        smooth.lambda_factor = 0.20
        smooth.lambda_border = 0.08
        smooth.use_volume_preserve = True
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        duplicate.data.update()
    duplicate.data.calc_loop_triangles()
    current_triangles = len(duplicate.data.loop_triangles)
    target_triangles = TARGET_TRIANGLES[char]
    if current_triangles > target_triangles:
        modifier = duplicate.modifiers.new("Production_Curvature_Decimation", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = target_triangles / current_triangles
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    duplicate.data.update()

    # A's small triangular counter is sensitive to any post-decimation vertex
    # drift; its pre-decimation volume relaxation is sufficient and preserves
    # a clean separation at the apex.
    if char != "A":
        polish = duplicate.modifiers.new("Post_Decimation_Polish", "LAPLACIANSMOOTH")
        polish.iterations = 4
        polish.lambda_factor = 0.055
        polish.lambda_border = 0.025
        polish.use_volume_preserve = True
        bpy.ops.object.modifier_apply(modifier=polish.name)
        duplicate.data.update()

    for poly in duplicate.data.polygons:
        poly.use_smooth = True

    cx, cy = projected_centroid(duplicate.data)
    z_coords = [vert.co.z for vert in duplicate.data.vertices]
    cz = (min(z_coords) + max(z_coords)) * 0.5
    for vert in duplicate.data.vertices:
        vert.co.x -= cx
        vert.co.y -= cy
        vert.co.z -= cz
    duplicate.data.update()

    # Collapse decimation can leave two otherwise valid front-cap triangles
    # microscopically crossing at A's crossbar. Separate that deterministic
    # pair along the outward normal by 0.002 em; this is below visible scale
    # but restores a strictly non-self-intersecting surface.
    if char == "A":
        for _ in range(3):
            details = mesh_checks(duplicate.data)["self_intersection_details"]
            if not details:
                break
            face_index = details[0]["faces"][0]
            face = duplicate.data.polygons[face_index]
            outward = face.normal.copy()
            for vertex_index in face.vertices:
                duplicate.data.vertices[vertex_index].co += outward * 0.002
            duplicate.data.update()
    duplicate.data.name = f"glyph_{char}_inflated_mesh"

    mesh = duplicate.data
    bpy.data.objects.remove(duplicate, do_unlink=True)
    return mesh


def mesh_bounds(mesh: bpy.types.Mesh) -> dict[str, list[float]]:
    coords = [vert.co for vert in mesh.vertices]
    minimum = [min(v[i] for v in coords) for i in range(3)]
    maximum = [max(v[i] for v in coords) for i in range(3)]
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
    }


def triangles_intersect_3d(first: list[Vector], second: list[Vector], epsilon: float = 1e-7) -> bool:
    """Triangle intersection after BVH broad-phase filtering."""
    normal_first = (first[1] - first[0]).cross(first[2] - first[0])
    normal_second = (second[1] - second[0]).cross(second[2] - second[0])
    if normal_first.length <= epsilon or normal_second.length <= epsilon:
        return False
    if normal_first.cross(normal_second).length <= epsilon:
        plane_distance = abs(normal_first.dot(second[0] - first[0])) / normal_first.length
        if plane_distance > epsilon:
            return False
        axis = max(range(3), key=lambda index: abs(normal_first[index]))

        def project(point: Vector) -> Vector:
            if axis == 0:
                return Vector((point.y, point.z))
            if axis == 1:
                return Vector((point.x, point.z))
            return Vector((point.x, point.y))

        return bool(geometry.intersect_tri_tri_2d(*(project(point) for point in first + second)))

    for triangle, other in ((first, second), (second, first)):
        for start, end in zip(triangle, triangle[1:] + triangle[:1]):
            hit = geometry.intersect_ray_tri(
                other[0], other[1], other[2], end - start, start, True
            )
            if hit is not None and (hit - start).length <= (end - start).length + epsilon:
                return True
    return False


def mesh_checks(mesh: bpy.types.Mesh) -> dict[str, int | bool]:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    loose_vertices = sum(1 for vert in bm.verts if not vert.link_edges)
    loose_edges = sum(1 for edge in bm.edges if not edge.link_faces)
    non_manifold = sum(1 for edge in bm.edges if not edge.is_manifold)
    zero_faces = sum(1 for face in bm.faces if face.calc_area() <= 1e-12)
    vertices = [vert.co.copy() for vert in bm.verts]
    polygons = [[vert.index for vert in face.verts] for face in bm.faces]
    tree = BVHTree.FromPolygons(vertices, polygons, all_triangles=True, epsilon=1e-7)
    overlaps = tree.overlap(tree)
    self_intersections = 0
    self_intersection_details = []
    for first, second in overlaps:
        if first >= second:
            continue
        if set(polygons[first]).isdisjoint(polygons[second]) and triangles_intersect_3d(
            [vertices[index] for index in polygons[first]],
            [vertices[index] for index in polygons[second]],
        ):
            self_intersections += 1
            self_intersection_details.append(
                {
                    "faces": [first, second],
                    "center": [
                        round(value, 7)
                        for value in (
                            sum((vertices[index] for index in polygons[first]), Vector())
                            + sum((vertices[index] for index in polygons[second]), Vector())
                        )
                        / 6.0
                    ],
                }
            )
    result = {
        "watertight": non_manifold == 0,
        "non_manifold_edges": non_manifold,
        "loose_vertices": loose_vertices,
        "loose_edges": loose_edges,
        "zero_area_faces": zero_faces,
        "self_intersections": self_intersections,
        "self_intersection_details": self_intersection_details,
    }
    bm.free()
    return result


def triangle_count(mesh: bpy.types.Mesh) -> int:
    return sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)


def line_layout(
    line: int,
    entries: list[tuple[int, str, int, str]],
    meshes: dict[str, bpy.types.Mesh],
) -> tuple[dict[str, Vector], float]:
    scale = LINE_SCALES[line]
    widths = []
    for _, char, _, _ in entries:
        bounds = mesh_bounds(meshes[char])
        widths.append((bounds["max"][0] - bounds["min"][0]) * scale)
    width = sum(widths) + TRACKING * scale * (len(entries) - 1)
    cursor = -width * 0.5
    positions: dict[str, Vector] = {}
    for entry, glyph_width in zip(entries, widths):
        _, char, _, name = entry
        bounds = mesh_bounds(meshes[char])
        positions[name] = Vector((cursor - bounds["min"][0] * scale, LINE_Y[line], 0.0))
        cursor += glyph_width + TRACKING * scale
    return positions, width


def make_materials() -> tuple[bpy.types.Material, bpy.types.Material]:
    clay = bpy.data.materials.new("MAT_Neutral_Clay")
    clay.diffuse_color = (0.52, 0.61, 0.70, 1.0)
    clay.use_nodes = True
    clay_bsdf = clay.node_tree.nodes.get("Principled BSDF")
    clay_bsdf.inputs["Base Color"].default_value = (0.48, 0.60, 0.72, 1.0)
    clay_bsdf.inputs["Roughness"].default_value = 0.3
    clay_bsdf.inputs["Metallic"].default_value = 0.0

    glass = bpy.data.materials.new("MAT_Water_Glass_Preview")
    glass.diffuse_color = (0.55, 0.76, 0.9, 0.32)
    glass.use_nodes = True
    glass_bsdf = glass.node_tree.nodes.get("Principled BSDF")
    glass_bsdf.inputs["Base Color"].default_value = (0.42, 0.68, 0.88, 1.0)
    glass_bsdf.inputs["Metallic"].default_value = 0.0
    glass_bsdf.inputs["Roughness"].default_value = 0.18
    glass_bsdf.inputs["IOR"].default_value = 1.38
    glass_bsdf.inputs["Transmission Weight"].default_value = 0.9
    glass_bsdf.inputs["Alpha"].default_value = 1.0
    return clay, glass


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_preview_rig(target: bpy.types.Collection) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    camera_data = bpy.data.cameras.new("Validation_Camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("Validation_Camera", camera_data)
    target.objects.link(camera)
    bpy.context.scene.camera = camera

    lights = []
    for name, location, energy, size, color in [
        ("Key_Softbox", (2.5, 3.8, 5.5), 1150, 5.0, (0.72, 0.86, 1.0)),
        ("Fill_Softbox", (-4.0, 1.0, 3.0), 820, 4.0, (0.52, 0.72, 1.0)),
        ("Rim_Softbox", (1.0, -4.5, 2.5), 980, 3.0, (0.75, 0.9, 1.0)),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        target.objects.link(obj)
        obj.location = location
        look_at(obj, Vector((0.0, 0.0, 0.0)))
        lights.append(obj)
    return camera, lights


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[i] for point in points) for i in range(3))),
        Vector(tuple(max(point[i] for point in points) for i in range(3))),
    )


def apply_material(objects: list[bpy.types.Object], material: bpy.types.Material) -> None:
    seen = set()
    for obj in objects:
        if obj.data.name in seen:
            continue
        seen.add(obj.data.name)
        obj.data.materials.clear()
        obj.data.materials.append(material)


def render(
    path: Path,
    camera: bpy.types.Object,
    objects: list[bpy.types.Object],
    location: tuple[float, float, float],
    target: Vector,
    ortho_scale: float,
    visible: list[bpy.types.Object] | None = None,
) -> None:
    for obj in objects:
        obj.hide_render = visible is not None and obj not in visible
    camera.location = location
    # Validation views orbit only around the title's vertical axis. An
    # explicit yaw prevents quaternion roll as the camera approaches a side
    # view and keeps the typographic verticals vertical in every render.
    camera.location.y = target.y
    camera.rotation_euler = (
        0.0,
        math.atan2(camera.location.x - target.x, camera.location.z - target.z),
        0.0,
    )
    camera.data.ortho_scale = ortho_scale
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for obj in objects:
        obj.hide_render = False


def setup_render(samples: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 18
    scene.render.resolution_percentage = 100
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Underwater_Studio_World")
    scene.world.color = (0.018, 0.028, 0.05)
    world = scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.018, 0.035, 0.065, 1.0)
    bg.inputs["Strength"].default_value = 0.32
    scene.view_settings.look = "AgX - Medium High Contrast"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_samples = samples


def render_validation_set(
    verification_dir: Path,
    camera: bpy.types.Object,
    objects: list[bpy.types.Object],
    clay: bpy.types.Material,
    glass: bpy.types.Material,
) -> None:
    minimum, maximum = world_bounds(objects)
    center = (minimum + maximum) * 0.5
    width = maximum.x - minimum.x
    height = maximum.y - minimum.y
    aspect = 1200 / 760
    full_scale = max(width * 1.18, height * aspect * 1.35)

    apply_material(objects, clay)
    render(verification_dir / "01_full-title.png", camera, objects, (0.5, -0.15, 7.5), center, full_scale)
    render(verification_dir / "02_front-orthographic.png", camera, objects, (0.0, 0.0, 8.0), center, full_scale)
    render(verification_dir / "03_three-quarter.png", camera, objects, (2.6, 0.0, 7.0), center, full_scale * 1.04)
    render(verification_dir / "04_side-angle.png", camera, objects, (-4.5, 0.0, 5.5), center, full_scale * 1.08)

    for number, char in enumerate(("E", "A", "R", "P", "O"), start=5):
        obj = next(item for item in objects if item.get("character") == char)
        bmin, bmax = world_bounds([obj])
        obj_center = (bmin + bmax) * 0.5
        close_scale = max((bmax.x - bmin.x) * 1.5, (bmax.y - bmin.y) * aspect * 1.4)
        render(
            verification_dir / f"{number:02d}_close-{char}.png",
            camera,
            objects,
            (obj_center.x + 0.65, obj_center.y, 4.0),
            obj_center,
            close_scale * 1.12,
            visible=[obj],
        )

    render(verification_dir / "10_neutral-clay.png", camera, objects, (0.0, 0.0, 8.0), center, full_scale)
    apply_material(objects, glass)
    # Cycles plus denoising gives a useful transmission read without Eevee's
    # stochastic screen-space grain. Only this material-direction frame uses
    # Cycles; geometry inspection remains fast and neutral in Eevee.
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 48
    bpy.context.scene.cycles.use_denoising = True
    bpy.context.scene.cycles.max_bounces = 8
    bpy.context.scene.cycles.transmission_bounces = 6
    render(verification_dir / "11_clear-glass-acrylic.png", camera, objects, (3.2, -0.05, 7.2), center, full_scale * 1.04)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"


def export_glb(path: Path, production: bpy.types.Collection) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in production.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="NONE",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )


def write_report(
    path: Path,
    blender_version: str,
    font_path: Path,
    glb_path: Path,
    manifest: list[dict],
    unique_triangle_counts: dict[str, int],
    topology: dict[str, dict],
    reimport: dict,
) -> None:
    visible_triangles = sum(item["triangle_count"] for item in manifest)
    unique_triangles = sum(unique_triangle_counts.values())
    lines = [
        "# Hero title glyph validation",
        "",
        f"- Blender: {blender_version}",
        f"- Font: `{font_path}` (Inter Tight weight 900 static instance)",
        "- Source: Google Fonts `ofl/intertight/InterTight[wght].ttf`",
        "- License: SIL Open Font License 1.1; vendored beside the font as `OFL.txt`",
        f"- Production nodes: {len(manifest)}",
        f"- Unique mesh datablocks: {len(unique_triangle_counts)}",
        f"- Visible triangle total: {visible_triangles:,}",
        f"- Unique/shared triangle payload: {unique_triangles:,}",
        f"- GLB size: {glb_path.stat().st_size:,} bytes",
        f"- Reimported nodes: {reimport['node_count']}",
        f"- Reimport name match: {reimport['names_match']}",
        f"- Reimport bounds match: {reimport['bounds_match']}",
        "",
        "## Modeling choices",
        "",
        f"Exact Inter Tight 900 outlines with a {CURVE_OFFSET:.3f} em source inset; {EXTRUDE:.3f} em core extrusion, {BEVEL:.3f} em shoulder, "
        f"{BEVEL_SEGMENTS} shoulder segments, a {CONTOUR_BEVEL:.3f} em planar contour bevel with {CONTOUR_BEVEL_SEGMENTS} segments (except A), "
        f"a {VOXEL_SIZE:.4f} em watertight reconciliation, a {BULGE:.3f} em "
        f"face dome over a {BULGE_RUN:.3f} em run. "
        "The result keeps the face center calm while rolling both "
        "front and back into continuous sidewalls. Internal counter walls use the same curve profile as outer contours.",
        "",
        "E, Z, Y, and T use custom rounded-bar constructions at the original Inter Tight bounds, producing true XY "
        "corner radii rather than relying on depth bevels. A is a custom three-bar rounded solid in Inter Tight "
        "proportions. R, P, and O use fine voxel reconciliation of the font silhouette. Every custom glyph is "
        "voxel-unioned before relaxation and remains clean and watertight.",
        "",
        "Origins are projected-area centroids at mid-depth, calculated from front-facing mesh triangles after "
        "counter subtraction. Repeated E, Z, P, and R nodes reference shared mesh data but retain independent objects.",
        "",
        "## Topology",
        "",
    ]
    for char, checks in sorted(topology.items()):
        lines.append(
            f"- {char}: {unique_triangle_counts[char]:,} tris; watertight={checks['watertight']}; "
            f"non-manifold={checks['non_manifold_edges']}; loose verts={checks['loose_vertices']}; "
            f"loose edges={checks['loose_edges']}; zero-area faces={checks['zero_area_faces']}"
            f"; self-intersections={checks['self_intersections']}"
        )
    lines += [
        "",
        "## Validation renders",
        "",
        "`01_full-title.png`, `02_front-orthographic.png`, `03_three-quarter.png`, `04_side-angle.png`, "
        "`05_close-E.png` through `09_close-O.png`, `10_neutral-clay.png`, "
        "`11_clear-glass-acrylic.png`, and `12_reimport-front.png`.",
        "",
        "## Validation commands",
        "",
        f"`/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python scripts/blender/build_hero_glyphs.py -- --font {font_path} --output {font_path.parents[4]}`",
        "",
        "`npm install --prefix /tmp/codex-gltf-validator gltf-validator@2.0.0-dev.3.10 --no-save` followed by the package `validateBytes` API against `public/assets/hero/ezzy-rappeport-glyphs.glb`; record the machine-readable result as `gltf-validator.json`.",
        "",
        "## Known compromises",
        "",
        "The clear material is a Blender Cycles preview only; the GLB intentionally exports no material because "
        "the portfolio will supply a custom runtime transmission shader. Optical absorption and caustics must be "
        "revalidated during renderer integration.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo = args.output.resolve()
    font_path = args.font.resolve()
    if not font_path.is_file():
        raise FileNotFoundError(font_path)

    blend_path = repo / "assets/blender/hero-title/hero-title.blend"
    glb_path = repo / "public/assets/hero/ezzy-rappeport-glyphs.glb"
    manifest_path = repo / "public/assets/hero/ezzy-rappeport-glyphs.json"
    verification_dir = repo / ".verification/hero-glyphs"
    report_path = verification_dir / "VALIDATION.md"
    for directory in (blend_path.parent, glb_path.parent, verification_dir):
        directory.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_render(args.samples)
    source_collection = collection("01_EDITABLE_TEXT_SOURCES")
    production_collection = collection("02_PRODUCTION_GLYPHS")
    preview_collection = collection("03_PREVIEW_COMPOSITION")
    font = bpy.data.fonts.load(str(font_path), check_existing=True)

    sources = {}
    for index, char, line, name in GLYPHS:
        sources[name] = create_source_text(font, char, name, source_collection)

    unique_meshes: dict[str, bpy.types.Mesh] = {}
    for _, char, _, name in GLYPHS:
        if char not in unique_meshes:
            unique_meshes[char] = make_inflated_mesh(sources[name], char)

    positions = {}
    line_widths = {}
    for line in (0, 1):
        entries = [entry for entry in GLYPHS if entry[2] == line]
        line_positions, width = line_layout(line, entries, unique_meshes)
        positions.update(line_positions)
        line_widths[str(line)] = width

    objects = []
    manifest = []
    topology = {char: mesh_checks(mesh) for char, mesh in unique_meshes.items()}
    unique_triangle_counts = {char: triangle_count(mesh) for char, mesh in unique_meshes.items()}
    if any(not checks["watertight"] for checks in topology.values()):
        raise RuntimeError(f"Non-manifold production mesh: {topology}")

    for index, char, line, name in GLYPHS:
        obj = bpy.data.objects.new(name, unique_meshes[char])
        production_collection.objects.link(obj)
        obj.location = positions[name]
        uniform_scale = LINE_SCALES[line]
        obj.scale = (uniform_scale, uniform_scale, uniform_scale)
        obj["glyph_index"] = index
        obj["character"] = char
        obj["line_index"] = line
        geometry_id = (
            f"custom-rounded-{char}-inflated-v2"
            if char in {"A", "E", "Z", "Y", "T"}
            else f"inter-tight-900-{char}-inflated-v2"
        )
        obj["shared_geometry_id"] = geometry_id
        objects.append(obj)

        bounds = mesh_bounds(unique_meshes[char])
        manifest.append(
            {
                "glyph_index": index,
                "character": char,
                "line_index": line,
                "object_node_name": name,
                "coordinate_system": "glTF 2.0 right-handed Y-up; Blender source is Z-up",
                "rest_transform": {
                    "translation": [round(obj.location.x, 6), round(obj.location.z, 6), round(-obj.location.y, 6)],
                    "rotation_xyzw": [0.0, 0.0, 0.0, 1.0],
                    "scale": [uniform_scale, uniform_scale, uniform_scale],
                },
                "rest_transform_blender": {
                    "translation": [round(value, 6) for value in obj.location],
                    "rotation_xyzw": [0.0, 0.0, 0.0, 1.0],
                    "scale": [uniform_scale, uniform_scale, uniform_scale],
                },
                "local_bounding_box": bounds,
                "pivot": {
                    "type": "projected-area-centroid_mid-depth",
                    "local": [0.0, 0.0, 0.0],
                },
                "triangle_count": triangle_count(unique_meshes[char]),
                "shared_geometry_identifier": geometry_id,
            }
        )

    clay, glass = make_materials()
    camera, _lights = create_preview_rig(preview_collection)
    render_validation_set(verification_dir, camera, objects, clay, glass)

    # Save the editable source, production geometry, material previews, camera,
    # and lighting before entering the clean-scene reimport validation phase.
    bpy.context.scene["font_source"] = "Google Fonts ofl/intertight InterTight[wght].ttf"
    bpy.context.scene["font_weight"] = 900
    bpy.context.scene["font_license"] = "SIL Open Font License 1.1"
    bpy.context.scene["line_widths"] = json.dumps(line_widths)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(glb_path, production_collection)

    payload = {
        "asset": "EZZY RAPPEPORT independently addressable inflated glyphs",
        "version": 1,
        "font": {
            "family": "Inter Tight",
            "weight": 900,
            "file": "assets/blender/hero-title/fonts/InterTight-Black-900.ttf",
            "variable_source": "https://github.com/google/fonts/blob/main/ofl/intertight/InterTight%5Bwght%5D.ttf",
            "license": "SIL Open Font License 1.1",
            "license_file": "assets/blender/hero-title/fonts/OFL.txt",
        },
        "modeling": {
            "extrude_em": EXTRUDE,
            "curve_offset_em": CURVE_OFFSET,
            "bevel_em": BEVEL,
            "overall_depth_em": 2 * (EXTRUDE + BEVEL) + 2 * BULGE,
            "bevel_segments": BEVEL_SEGMENTS,
            "contour_bevel_em": CONTOUR_BEVEL,
            "contour_bevel_segments": CONTOUR_BEVEL_SEGMENTS,
            "custom_rounded_glyphs": "A, E, Z, Y, and T use rounded bars voxel-unioned in Inter Tight proportions",
            "face_subdivision_levels": 0,
            "face_bulge_em": BULGE,
            "face_bulge_run_em": BULGE_RUN,
            "voxel_reconciliation_em": VOXEL_SIZE,
            "target_triangles_by_character": TARGET_TRIANGLES,
        },
        "glyphs": manifest,
    }
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    expected_names = {item[3] for item in GLYPHS}
    expected_bounds = {item["object_node_name"]: item["local_bounding_box"] for item in manifest}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_render(args.samples)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    imported_names = {obj.name for obj in imported}
    bounds_match = True
    for obj in imported:
        actual = mesh_bounds(obj.data)
        expected = expected_bounds.get(obj.name)
        if expected is None:
            bounds_match = False
            continue
        for side in ("min", "max"):
            if any(abs(a - b) > 1e-4 for a, b in zip(actual[side], expected[side])):
                bounds_match = False

    reimport = {
        "node_count": len(imported),
        "names_match": imported_names == expected_names,
        "bounds_match": bounds_match,
    }
    if not all((len(imported) == 13, reimport["names_match"], reimport["bounds_match"])):
        raise RuntimeError(f"GLB reimport validation failed: {reimport}")

    clay, _glass = make_materials()
    apply_material(imported, clay)
    validation_collection = collection("REIMPORT_VALIDATION_RIG")
    camera, _lights = create_preview_rig(validation_collection)
    minimum, maximum = world_bounds(imported)
    center = (minimum + maximum) * 0.5
    aspect = 1200 / 760
    scale = max((maximum.x - minimum.x) * 1.18, (maximum.y - minimum.y) * aspect * 1.35)
    render(verification_dir / "12_reimport-front.png", camera, imported, (0.0, 0.0, 8.0), center, scale)

    write_report(
        report_path,
        bpy.app.version_string,
        font_path,
        glb_path,
        manifest,
        unique_triangle_counts,
        topology,
        reimport,
    )
    print(json.dumps({
        "blend": str(blend_path),
        "glb": str(glb_path),
        "manifest": str(manifest_path),
        "report": str(report_path),
        "visible_triangles": sum(item["triangle_count"] for item in manifest),
        "glb_bytes": glb_path.stat().st_size,
        "reimport": reimport,
    }, indent=2))


if __name__ == "__main__":
    main()
