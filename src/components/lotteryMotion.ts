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

function constrainNodeToChamber(
  node: BallMotionNode,
  boundary: number,
  restitution: number,
  friction = 1,
): void {
  const distance = Math.hypot(node.x, node.y, node.z);

  if (distance <= boundary) {
    return;
  }

  const normalX = node.x / distance;
  const normalY = node.y / distance;
  const normalZ = node.z / distance;
  node.x = normalX * boundary;
  node.y = normalY * boundary;
  node.z = normalZ * boundary;

  const outwardVelocity =
    node.vx * normalX + node.vy * normalY + node.vz * normalZ;

  if (outwardVelocity > 0) {
    node.vx -= (1 + restitution) * outwardVelocity * normalX;
    node.vy -= (1 + restitution) * outwardVelocity * normalY;
    node.vz -= (1 + restitution) * outwardVelocity * normalZ;
  }

  if (friction < 1) {
    const radialVelocity =
      node.vx * normalX + node.vy * normalY + node.vz * normalZ;
    node.vx =
      radialVelocity * normalX +
      (node.vx - radialVelocity * normalX) * friction;
    node.vy =
      radialVelocity * normalY +
      (node.vy - radialVelocity * normalY) * friction;
    node.vz =
      radialVelocity * normalZ +
      (node.vz - radialVelocity * normalZ) * friction;
  }
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
  const crossingPhase = time * 1.55 + index * GOLDEN_ANGLE;
  const crossingWave = Math.sin(crossingPhase);
  const crossingPulse = (1 - Math.abs(crossingWave)) ** 2;
  const rotation = isMixing
    ? 1.15 + (1 - crossingPulse) * 1.75
    : 0.42;
  const axisWave = Math.sin(time * 0.83);
  const crossWave = Math.cos(time * 0.61);
  const turbulence = chamberRadius * (isMixing ? 1.2 : 0.08);
  const transitPull = isMixing ? 4.4 + crossingPulse * 6.2 : 0.12;
  const transitAngle = index * GOLDEN_ANGLE * 0.73 + time * 0.16;
  const transitElevation =
    Math.sin(index * 1.21 + time * 0.11) * 0.58;
  const transitPlanarScale = Math.sqrt(1 - transitElevation ** 2);
  const targetRadius = isMixing ? chamberRadius * 0.58 * crossingWave : 0;
  const targetX = Math.cos(transitAngle) * transitPlanarScale * targetRadius;
  const targetY = Math.sin(transitAngle) * transitPlanarScale * targetRadius;
  const targetZ = transitElevation * targetRadius;
  const transitJet =
    chamberRadius * (isMixing ? Math.cos(crossingPhase) * 2.25 : 0);

  const accelerationX =
    (-node.y * rotation + node.z * (1.05 + axisWave * 0.55)) * energy +
    Math.sin(time * 3.35 + index * 1.73) * turbulence -
    (node.x - targetX) * transitPull +
    Math.cos(transitAngle) * transitPlanarScale * transitJet;
  const accelerationY =
    (node.x * rotation - node.z * (1.45 + crossWave * 0.5)) * energy +
    Math.cos(time * 2.75 + index * 1.31) * turbulence -
    (node.y - targetY) * transitPull +
    Math.sin(transitAngle) * transitPlanarScale * transitJet;
  const accelerationZ =
    (node.y * (1.45 + crossWave * 0.5) -
      node.x * (1.05 + axisWave * 0.55)) *
      energy +
    Math.sin(time * 3.9 + index * 1.17) * turbulence -
    (node.z - targetZ) * transitPull +
    transitElevation * transitJet;

  node.vx += accelerationX * delta;
  node.vy += accelerationY * delta;
  node.vz += accelerationZ * delta;

  const damping = Math.pow(isMixing ? 0.991 : 0.94, delta * 60);
  node.vx *= damping;
  node.vy *= damping;
  node.vz *= damping;

  const speed = Math.hypot(node.vx, node.vy, node.vz);
  const maximumSpeed = isMixing ? 340 : 48;

  if (speed > maximumSpeed) {
    const speedScale = maximumSpeed / speed;
    node.vx *= speedScale;
    node.vy *= speedScale;
    node.vz *= speedScale;
  }

  node.x += node.vx * delta;
  node.y += node.vy * delta;
  node.z += node.vz * delta;

  const boundary = Math.max(
    chamberRadius * 0.2,
    chamberRadius - physicalRadius * 1.35 - 6,
  );

  constrainNodeToChamber(node, boundary, 0.78);
}

export function advanceSettlingBallMotionNodes(
  nodes: BallMotionNode[],
  delta: number,
  chamberRadius: number,
  physicalRadius: number,
): void {
  const boundedDelta = Math.min(0.034, Math.max(0, delta));
  const boundary = Math.max(
    chamberRadius * 0.2,
    chamberRadius - physicalRadius * 1.35 - 6,
  );
  const gravity = chamberRadius * 3.8;
  const drag = Math.pow(0.988, boundedDelta * 60);

  for (const node of nodes) {
    node.vy += gravity * boundedDelta;
    node.vx *= drag;
    node.vy *= drag;
    node.vz *= drag;
    node.x += node.vx * boundedDelta;
    node.y += node.vy * boundedDelta;
    node.z += node.vz * boundedDelta;
    constrainNodeToChamber(node, boundary, 0.16, 0.82);
  }

  const minimumDistance = physicalRadius * 2;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      const first = nodes[firstIndex];

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < nodes.length;
        secondIndex += 1
      ) {
        const second = nodes[secondIndex];
        let differenceX = second.x - first.x;
        let differenceY = second.y - first.y;
        let differenceZ = second.z - first.z;
        let distance = Math.hypot(differenceX, differenceY, differenceZ);

        if (distance >= minimumDistance) {
          continue;
        }

        if (distance < 0.001) {
          const separationAngle = (firstIndex + secondIndex) * GOLDEN_ANGLE;
          differenceX = Math.cos(separationAngle);
          differenceY = 0.35;
          differenceZ = Math.sin(separationAngle);
          distance = Math.hypot(differenceX, differenceY, differenceZ);
        }

        const normalX = differenceX / distance;
        const normalY = differenceY / distance;
        const normalZ = differenceZ / distance;
        const correction = (minimumDistance - distance) / 2;

        first.x -= normalX * correction;
        first.y -= normalY * correction;
        first.z -= normalZ * correction;
        second.x += normalX * correction;
        second.y += normalY * correction;
        second.z += normalZ * correction;

        const relativeVelocity =
          (second.vx - first.vx) * normalX +
          (second.vy - first.vy) * normalY +
          (second.vz - first.vz) * normalZ;

        if (relativeVelocity < 0) {
          const impulse = (-(1 + 0.12) * relativeVelocity) / 2;
          first.vx -= impulse * normalX;
          first.vy -= impulse * normalY;
          first.vz -= impulse * normalZ;
          second.vx += impulse * normalX;
          second.vy += impulse * normalY;
          second.vz += impulse * normalZ;
        }
      }
    }

    for (const node of nodes) {
      constrainNodeToChamber(node, boundary, 0.12, 0.78);
    }
  }

  const sleepThreshold = gravity * boundedDelta * 1.35 + 1;

  for (const node of nodes) {
    if (Math.hypot(node.vx, node.vy, node.vz) < sleepThreshold) {
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
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
    radius: baseRadius,
    opacity: 0.68 + normalizedDepth * 0.32,
    depth,
    perspective,
  };
}

/**
 * WebGL 모드에서 카메라 원근에 따라 좌표와 공 크기를 함께 투영한다.
 * 기존 2D 모드의 동일 크기 계약은 `projectBallMotionNode`에 그대로 둔다.
 */
export function projectBallMotionNode3d(
  node: BallMotionNode,
  centerX: number,
  centerY: number,
  chamberRadius: number,
  baseRadius: number,
): ProjectedBallNode {
  const normalizedChamberRadius = Math.max(1, chamberRadius);
  const depth = clamp(node.z / normalizedChamberRadius, -1, 1);
  const cameraDistance = normalizedChamberRadius * 2.6;
  const perspective = clamp(
    cameraDistance / Math.max(1, cameraDistance - node.z),
    0.7,
    1.5,
  );
  const normalizedDepth = (depth + 1) / 2;

  return {
    x: centerX + node.x * perspective,
    y: centerY + node.y * perspective,
    radius: baseRadius * perspective,
    opacity: 0.76 + normalizedDepth * 0.24,
    depth,
    perspective,
  };
}
