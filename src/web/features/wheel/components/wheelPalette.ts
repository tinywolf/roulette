const WHEEL_SEGMENT_COLORS = [
  "#ff6b68",
  "#ffb84d",
  "#ffd95a",
  "#63cf9a",
  "#62b8ff",
  "#8f87ff",
  "#d47be8",
  "#f38ab4",
];

/** 돌림판 구획과 해당 당첨 결과가 같은 순서 기반 색상을 사용하게 한다. */
export function getWheelSegmentColor(candidateIndex: number): string {
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0) {
    throw new RangeError("후보 인덱스는 0 이상의 정수여야 합니다.");
  }

  return WHEEL_SEGMENT_COLORS[candidateIndex % WHEEL_SEGMENT_COLORS.length];
}
