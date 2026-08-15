export type WheelSegment = {
  index: number;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
};

type TargetRotationArgs = {
  currentRotation: number;
  candidateIndex: number;
  candidateCount: number;
  pointerAngle: number;
  minimumFullRotations: number;
};

function assertCandidatePosition(
  candidateIndex: number,
  candidateCount: number,
): void {
  if (
    !Number.isInteger(candidateCount) ||
    candidateCount < 1 ||
    !Number.isInteger(candidateIndex) ||
    candidateIndex < 0 ||
    candidateIndex >= candidateCount
  ) {
    throw new RangeError("후보 인덱스와 후보 수가 유효해야 합니다.");
  }
}

export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    throw new RangeError("각도는 유한한 숫자여야 합니다.");
  }

  return ((angle % 360) + 360) % 360;
}

export function getSegmentCenterAngle(
  candidateIndex: number,
  candidateCount: number,
): number {
  assertCandidatePosition(candidateIndex, candidateCount);
  const segmentAngle = 360 / candidateCount;
  return candidateIndex * segmentAngle + segmentAngle / 2;
}

/** 상단을 0도로 삼아 시계 방향으로 배치할 동일 크기 SVG 구획을 계산한다. */
export function getWheelSegments(candidateCount: number): WheelSegment[] {
  assertCandidatePosition(0, candidateCount);
  const segmentAngle = 360 / candidateCount;

  return Array.from({ length: candidateCount }, (_, index) => ({
    index,
    startAngle: index * segmentAngle,
    endAngle: (index + 1) * segmentAngle,
    centerAngle: getSegmentCenterAngle(index, candidateCount),
  }));
}

/** 현재 누적값보다 큰 시계 방향 회전각으로 목표 구획 중심을 포인터에 맞춘다. */
export function getTargetRotation({
  currentRotation,
  candidateIndex,
  candidateCount,
  pointerAngle,
  minimumFullRotations,
}: TargetRotationArgs): number {
  assertCandidatePosition(candidateIndex, candidateCount);

  if (
    !Number.isFinite(currentRotation) ||
    currentRotation < 0 ||
    !Number.isFinite(pointerAngle) ||
    !Number.isInteger(minimumFullRotations) ||
    minimumFullRotations < 0
  ) {
    throw new RangeError("현재 각도와 회전 조건이 유효해야 합니다.");
  }

  const targetWithinTurn = normalizeAngle(
    pointerAngle - getSegmentCenterAngle(candidateIndex, candidateCount),
  );
  const alignmentDelta = normalizeAngle(
    targetWithinTurn - normalizeAngle(currentRotation),
  );
  const fullRotations = Math.max(1, minimumFullRotations);

  return currentRotation + fullRotations * 360 + alignmentDelta;
}
