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

/**
 * 하드 리밋 직전 공의 현재 운동을 정착 목표로 부드럽게 연결하는 전환 정보다.
 */
export type FinalSettlingTransition = {
  starts: BallMotionNode[];
  targets: BallMotionNode[];
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const SETTLING_SOFT_LIMIT_MS = 3_000;
export const SETTLING_FINALIZATION_START_MS = 5_000;
export const SETTLING_HARD_LIMIT_MS = 6_000;

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
  settlingElapsedMs = 0,
): void {
  const boundedDelta = Math.min(0.034, Math.max(0, delta));
  const boundary = Math.max(
    chamberRadius * 0.2,
    chamberRadius - physicalRadius * 1.35 - 6,
  );
  const gravity = chamberRadius * 3.8;
  const settlingUrgency = clamp(
    (settlingElapsedMs - SETTLING_SOFT_LIMIT_MS) /
      (SETTLING_HARD_LIMIT_MS - SETTLING_SOFT_LIMIT_MS),
    0,
    1,
  );
  const drag = Math.pow(
    0.988 - settlingUrgency * 0.028,
    boundedDelta * 60,
  );
  const boundaryRestitution = 0.16 * (1 - settlingUrgency);
  const collisionRestitution = 0.12 * (1 - settlingUrgency);
  const boundaryFriction = 0.82 - settlingUrgency * 0.22;

  for (const node of nodes) {
    node.vy += gravity * boundedDelta;
    node.vx *= drag;
    node.vy *= drag;
    node.vz *= drag;
    node.x += node.vx * boundedDelta;
    node.y += node.vy * boundedDelta;
    node.z += node.vz * boundedDelta;
    constrainNodeToChamber(
      node,
      boundary,
      boundaryRestitution,
      boundaryFriction,
    );
  }

  const minimumDistance = physicalRadius * 2;
  resolveSettlingCollisions(
    nodes,
    boundary,
    minimumDistance,
    collisionRestitution,
    3,
    0.78 - settlingUrgency * 0.18,
  );

  const sleepThreshold =
    gravity * boundedDelta * (1.35 + settlingUrgency * 1.2) + 1;

  nodes.forEach((node, index) => {
    if (
      isSettlingNodeSupported(
        nodes,
        index,
        boundary,
        minimumDistance,
        physicalRadius,
      ) &&
      Math.hypot(node.vx, node.vy, node.vz) < sleepThreshold
    ) {
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
    }
  });
}

function resolveSettlingCollisions(
  nodes: BallMotionNode[],
  boundary: number,
  minimumDistance: number,
  restitution: number,
  iterations: number,
  boundaryFriction: number,
): void {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
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
          const impulse = (-(1 + restitution) * relativeVelocity) / 2;
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
      constrainNodeToChamber(
        node,
        boundary,
        restitution,
        boundaryFriction,
      );
    }
  }
}

function isSettlingNodeSupported(
  nodes: BallMotionNode[],
  nodeIndex: number,
  boundary: number,
  minimumDistance: number,
  physicalRadius: number,
): boolean {
  const node = nodes[nodeIndex];
  const distanceFromCenter = Math.hypot(node.x, node.y, node.z);
  const supportTolerance = Math.max(1, physicalRadius * 0.18);

  if (
    distanceFromCenter >= boundary - supportTolerance &&
    node.y / Math.max(1, distanceFromCenter) > 0.25
  ) {
    return true;
  }

  for (let index = 0; index < nodes.length; index += 1) {
    if (index === nodeIndex) {
      continue;
    }

    const other = nodes[index];
    const differenceY = other.y - node.y;

    if (differenceY <= 0) {
      continue;
    }

    const distance = Math.hypot(
      other.x - node.x,
      differenceY,
      other.z - node.z,
    );

    if (
      distance <= minimumDistance + supportTolerance &&
      differenceY / Math.max(0.001, distance) > 0.2
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 정착 하드 리밋에서 짧은 고감쇠 물리 단계를 적용해 공을 바닥에 모은 뒤 고정한다.
 */
export function forceSettleBallMotionNodes(
  nodes: BallMotionNode[],
  chamberRadius: number,
  physicalRadius: number,
): void {
  for (let step = 0; step < 60; step += 1) {
    advanceSettlingBallMotionNodes(
      nodes,
      0.034,
      chamberRadius,
      physicalRadius,
      SETTLING_HARD_LIMIT_MS,
    );
  }

  const boundary = Math.max(
    chamberRadius * 0.2,
    chamberRadius - physicalRadius * 1.35 - 6,
  );
  const minimumDistance = physicalRadius * 2;
  resolveSettlingCollisions(
    nodes,
    boundary,
    minimumDistance,
    0,
    8,
    0.55,
  );

  for (const node of nodes) {
    constrainNodeToChamber(node, boundary, 0, 0.55);
    node.vx = 0;
    node.vy = 0;
    node.vz = 0;
  }
}

/**
 * 실제 노드를 즉시 옮기지 않고 최종 정착 위치를 별도의 복사본으로 계산한다.
 */
export function createFinalSettlingTransition(
  nodes: BallMotionNode[],
  chamberRadius: number,
  physicalRadius: number,
): FinalSettlingTransition {
  const starts = nodes.map((node) => ({ ...node }));
  const targets = nodes.map((node) => ({ ...node }));
  forceSettleBallMotionNodes(targets, chamberRadius, physicalRadius);

  return { starts, targets };
}

/**
 * 시작 속도를 보존하는 3차 보간으로 공을 정착 목표까지 이동시킨다.
 */
export function applyFinalSettlingTransition(
  nodes: BallMotionNode[],
  transition: FinalSettlingTransition,
  progress: number,
  durationMs: number,
): void {
  const normalizedProgress = clamp(progress, 0, 1);
  const progressSquared = normalizedProgress ** 2;
  const progressCubed = progressSquared * normalizedProgress;
  const startPositionWeight =
    2 * progressCubed - 3 * progressSquared + 1;
  const startVelocityWeight =
    progressCubed - 2 * progressSquared + normalizedProgress;
  const targetPositionWeight =
    -2 * progressCubed + 3 * progressSquared;
  const startPositionDerivative =
    6 * progressSquared - 6 * normalizedProgress;
  const startVelocityDerivative =
    3 * progressSquared - 4 * normalizedProgress + 1;
  const targetPositionDerivative =
    -6 * progressSquared + 6 * normalizedProgress;
  const durationSeconds = Math.max(0.001, durationMs / 1_000);
  const interpolatePosition = (
    startPosition: number,
    startVelocity: number,
    targetPosition: number,
  ) =>
    startPositionWeight * startPosition +
    startVelocityWeight * durationSeconds * startVelocity +
    targetPositionWeight * targetPosition;
  const interpolateVelocity = (
    startPosition: number,
    startVelocity: number,
    targetPosition: number,
  ) =>
    (startPositionDerivative * startPosition +
      startVelocityDerivative * durationSeconds * startVelocity +
      targetPositionDerivative * targetPosition) /
    durationSeconds;

  nodes.forEach((node, index) => {
    const start = transition.starts[index];
    const target = transition.targets[index];

    if (!start || !target || start.id !== node.id || target.id !== node.id) {
      return;
    }

    node.x = interpolatePosition(start.x, start.vx, target.x);
    node.y = interpolatePosition(start.y, start.vy, target.y);
    node.z = interpolatePosition(start.z, start.vz, target.z);

    if (normalizedProgress >= 1) {
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
      return;
    }

    node.vx = interpolateVelocity(start.x, start.vx, target.x);
    node.vy = interpolateVelocity(start.y, start.vy, target.y);
    node.vz = interpolateVelocity(start.z, start.vz, target.z);
  });
}

export function projectBallMotionNode(
  node: BallMotionNode,
  centerX: number,
  centerY: number,
  chamberRadius: number,
  baseRadius: number,
  target?: ProjectedBallNode,
): ProjectedBallNode {
  const depth = clamp(node.z / Math.max(1, chamberRadius), -1, 1);
  const normalizedDepth = (depth + 1) / 2;
  const perspective = 0.82 + normalizedDepth * 0.36;
  const projected = target ?? {
    x: 0,
    y: 0,
    radius: 0,
    opacity: 1,
    depth: 0,
    perspective: 1,
  };

  projected.x = centerX + node.x * perspective;
  projected.y = centerY + node.y * perspective;
  projected.radius = baseRadius;
  projected.opacity = 0.68 + normalizedDepth * 0.32;
  projected.depth = depth;
  projected.perspective = perspective;
  return projected;
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
  target?: ProjectedBallNode,
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
  const projected = target ?? {
    x: 0,
    y: 0,
    radius: 0,
    opacity: 1,
    depth: 0,
    perspective: 1,
  };

  projected.x = centerX + node.x * perspective;
  projected.y = centerY + node.y * perspective;
  projected.radius = baseRadius * perspective;
  projected.opacity = 0.76 + normalizedDepth * 0.24;
  projected.depth = depth;
  projected.perspective = perspective;
  return projected;
}
