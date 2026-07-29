import { ExtrudeGeometry, Shape, Vector2 } from "three";

type Point2 = readonly [number, number];

export function createRoundedPanelGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevelSize = Math.min(depth * 0.22, radius * 0.18),
): ExtrudeGeometry {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const corner = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();

  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);

  const geometry = new ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 6,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 3,
    bevelSize,
    bevelThickness: Math.min(depth * 0.18, bevelSize),
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

export function createPolygonPrismGeometry(
  points: readonly Point2[],
  depth: number,
  bevelSize = depth * 0.12,
): ExtrudeGeometry {
  if (points.length < 3) {
    throw new Error("Polygon prism requires at least three points");
  }
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 3,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 2,
    bevelSize,
    bevelThickness: Math.min(depth * 0.18, bevelSize),
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}
