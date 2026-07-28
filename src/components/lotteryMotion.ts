export type BallMotionNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type ProjectedBallNode = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  depth: number;
  perspective: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createBallMotionNode(
  id: string,
  index: number,
  total: number,
  chamberRadius: number,
): BallMotionNode {
  const normalizedTotal = Math.max(1, total);
  const latitude = 1 - (2 * (index + 0.5)) / normalizedTotal;
  const latitudeRadius = Math.sqrt(Math.max(0, 1 - latitude ** 2));
  const angle = index * GOLDEN_ANGLE + 0.4;
  const shellSeed = (index * 0.61803398875 + 0.23) % 1;
  const shellRadius =
    chamberRadius * (0.3 + 0.58 * Math.cbrt(0.08 + shellSeed * 0.92));
  const speed = 92 + (index % 7) * 8;

  return {
    id,
    x: Math.cos(angle) * latitudeRadius * shellRadius,
    y: latitude * shellRadius,
    z: Math.sin(angle) * latitudeRadius * shellRadius,
    vx: Math.cos(angle + 1.15) * speed,
    vy: Math.sin(angle * 1.37 + 0.65) * speed * 0.82,
    vz: Math.cos(angle * 0.83 - 0.45) * speed,
  };
}

export function scaleBallMotionNode(
  node: BallMotionNode,
  scale: number,
): void {
  node.x *= scale;
  node.y *= scale;
  node.z *= scale;
  node.vx *= scale;
  node.vy *= scale;
  node.vz *= scale;
}

export function advanceBallMotionNode(
  node: BallMotionNode,
  index: number,
  now: number,
  delta: number,
  isMixing: boolean,
  chamberRadius: number,
  physicalRadius: number,
): void {
  const time = now / 1_000;
  const energy = isMixing ? 1 : 0.08;
  const rotation = isMixing ? 2.45 : 0.42;
  const axisWave = Math.sin(time * 0.83);
  const crossWave = Math.cos(time * 0.61);
  const turbulence = chamberRadius * (isMixing ? 1.55 : 0.08);

  const accelerationX =
    (-node.y * rotation + node.z * (1.05 + axisWave * 0.55)) * energy +
    Math.sin(time * 3.35 + index * 1.73) * turbulence;
  const accelerationY =
    (node.x * rotation - node.z * (1.45 + crossWave * 0.5)) * energy +
    Math.cos(time * 2.75 + index * 1.31) * turbulence;
  const accelerationZ =
    (node.y * (1.45 + crossWave * 0.5) -
      node.x * (1.05 + axisWave * 0.55)) *
      energy +
    Math.sin(time * 3.9 + index * 1.17) * turbulence;

  node.vx += accelerationX * delta;
  node.vy += accelerationY * delta;
  node.vz += accelerationZ * delta;

  const damping = Math.pow(isMixing ? 0.994 : 0.94, delta * 60);
  node.vx *= damping;
  node.vy *= damping;
  node.vz *= damping;

  const speed = Math.hypot(node.vx, node.vy, node.vz);
  const maximumSpeed = isMixing ? 320 : 48;

  if (speed > maximumSpeed) {
    const speedScale = maximumSpeed / speed;
    node.vx *= speedScale;
    node.vy *= speedScale;
    node.vz *= speedScale;
  }

  node.x += node.vx * delta;
  node.y += node.vy * delta;
  node.z += node.vz * delta;

  const distance = Math.hypot(node.x, node.y, node.z);
  const boundary = Math.max(
    chamberRadius * 0.2,
    chamberRadius - physicalRadius * 1.35 - 6,
  );

  if (distance > boundary) {
    const normalX = node.x / distance;
    const normalY = node.y / distance;
    const normalZ = node.z / distance;
    node.x = normalX * boundary;
    node.y = normalY * boundary;
    node.z = normalZ * boundary;

    const outwardVelocity =
      node.vx * normalX + node.vy * normalY + node.vz * normalZ;

    if (outwardVelocity > 0) {
      node.vx -= 1.78 * outwardVelocity * normalX;
      node.vy -= 1.78 * outwardVelocity * normalY;
      node.vz -= 1.78 * outwardVelocity * normalZ;
    }
  }
}

export function projectBallMotionNode(
  node: BallMotionNode,
  centerX: number,
  centerY: number,
  chamberRadius: number,
  baseRadius: number,
): ProjectedBallNode {
  const depth = clamp(node.z / Math.max(1, chamberRadius), -1, 1);
  const normalizedDepth = (depth + 1) / 2;
  const perspective = 0.82 + normalizedDepth * 0.36;

  return {
    x: centerX + node.x * perspective,
    y: centerY + node.y * perspective,
    radius: baseRadius * (0.72 + normalizedDepth * 0.56),
    opacity: 0.52 + normalizedDepth * 0.48,
    depth,
    perspective,
  };
}
