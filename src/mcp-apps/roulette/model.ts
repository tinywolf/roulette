export type RouletteResultItem = {
  order: number;
  id: string;
  name: string;
};

export type RouletteResult = {
  candidateCount: number;
  drawCount: number;
  remainingCount: number;
  results: RouletteResultItem[];
};

export type RouletteDrawInput = {
  rawInput: string;
  drawCount: "all" | number;
};

const WHEEL_SEGMENT_COLORS = [
  "var(--accent)",
  "var(--accent-2)",
  "var(--accent-3)",
  "#5b6fdb",
] as const;

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

/** 호스트가 전달한 최초 추첨 입력 중 재추첨에 필요한 값만 검증해 보관한다. */
export function parseRouletteDrawInput(value: unknown): RouletteDrawInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { rawInput, drawCount } = candidate;
  if (
    typeof rawInput !== "string" ||
    rawInput.length === 0 ||
    (drawCount !== "all" && !isIntegerInRange(drawCount, 1, 45))
  ) {
    return null;
  }

  return { rawInput, drawCount };
}

/** 신뢰하지 않는 tool result를 애니메이션에 사용할 수 있는 최소 계약으로 검증한다. */
export function parseRouletteResult(value: unknown): RouletteResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { candidateCount, drawCount, remainingCount, results } = candidate;

  if (
    !isIntegerInRange(candidateCount, 2, 45) ||
    !isIntegerInRange(drawCount, 1, candidateCount) ||
    !isIntegerInRange(remainingCount, 0, candidateCount - 1) ||
    remainingCount !== candidateCount - drawCount ||
    !Array.isArray(results) ||
    results.length !== drawCount
  ) {
    return null;
  }

  const ids = new Set<string>();
  const parsedResults: RouletteResultItem[] = [];

  for (const [index, item] of results.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }

    const result = item as Record<string, unknown>;
    if (
      result.order !== index + 1 ||
      typeof result.id !== "string" ||
      result.id.length === 0 ||
      ids.has(result.id) ||
      typeof result.name !== "string" ||
      result.name.length === 0 ||
      result.name.length > 20
    ) {
      return null;
    }

    ids.add(result.id);
    parsedResults.push({
      order: result.order,
      id: result.id,
      name: result.name,
    });
  }

  return {
    candidateCount,
    drawCount,
    remainingCount,
    results: parsedResults,
  };
}

/** 결과 수가 많아도 전체 공개 시간이 과도하게 길어지지 않도록 간격을 제한한다. */
export function getRevealDelay(resultCount: number): number {
  return Math.max(90, Math.min(420, Math.floor(4_200 / resultCount)));
}

/** 전체 추첨 대상 수와 같은 개수의 색상 구획을 가진 룰렛 배경을 만든다. */
export function createWheelGradient(candidateCount: number): string {
  const segmentAngle = 360 / candidateCount;
  const dividerAngle = Math.min(1.2, segmentAngle * 0.12);
  const formatAngle = (angle: number) => `${Number(angle.toFixed(4))}deg`;
  const segments = Array.from({ length: candidateCount }, (_, index) => {
    const start = segmentAngle * index;
    const colorStart = start + dividerAngle;
    const end = segmentAngle * (index + 1);
    const color = WHEEL_SEGMENT_COLORS[index % WHEEL_SEGMENT_COLORS.length];

    return [
      `var(--line) ${formatAngle(start)} ${formatAngle(colorStart)}`,
      `${color} ${formatAngle(colorStart)} ${formatAngle(end)}`,
    ].join(", ");
  });

  return `conic-gradient(from -8deg, ${segments.join(", ")})`;
}
