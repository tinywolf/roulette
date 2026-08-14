import { useEffect, useRef } from "react";
import { normalizeAngle, getWheelSegments } from "../domain/wheelGeometry";
import type { WheelCandidate } from "../domain/wheelSession";

export const WHEEL_SPIN_DURATION_MS = 4_000;
export const REDUCED_MOTION_DURATION_MS = 220;
export const MINIMUM_FULL_ROTATIONS = 6;

const CENTER = 120;
const RADIUS = 106;
const LABEL_RADIUS = 69;
const DENSE_LABEL_RADIUS = 84;
const SEGMENT_COLORS = [
  "#ff6b68",
  "#ffb84d",
  "#ffd95a",
  "#63cf9a",
  "#62b8ff",
  "#8f87ff",
  "#d47be8",
  "#f38ab4",
];

type WheelStageProps = {
  candidates: WheelCandidate[];
  currentRotation: number;
  previousRotation: number;
  isSpinning: boolean;
  reducedMotion: boolean;
  statusLabel: string;
  onAnimationError?: () => void;
};

function pointOnCircle(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  };
}

function createSegmentPath(startAngle: number, endAngle: number): string {
  const start = pointOnCircle(RADIUS, startAngle);
  const end = pointOnCircle(RADIUS, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function segmentLabel(name: string, candidateCount: number, index: number) {
  if (candidateCount > 24) {
    return String(index + 1);
  }

  const maximumLength = candidateCount > 12 ? 4 : candidateCount > 6 ? 7 : 11;
  return name.length > maximumLength
    ? `${name.slice(0, maximumLength)}…`
    : name;
}

function readableLabelRotation(angle: number): number {
  return angle > 90 && angle < 270 ? angle + 180 : angle;
}

/** 확정된 목표각을 단일 SVG 그룹에 표현하며 결과 선택에는 관여하지 않는다. */
export function WheelStage({
  candidates,
  currentRotation,
  previousRotation,
  isSpinning,
  reducedMotion,
  statusLabel,
  onAnimationError,
}: WheelStageProps) {
  const wheelGroupRef = useRef<SVGGElement>(null);
  const segments = getWheelSegments(candidates.length);
  const visualRotation = reducedMotion
    ? normalizeAngle(currentRotation)
    : currentRotation;
  const visualPreviousRotation = reducedMotion
    ? normalizeAngle(previousRotation)
    : previousRotation;
  const duration = reducedMotion
    ? REDUCED_MOTION_DURATION_MS
    : WHEEL_SPIN_DURATION_MS;
  const hasDenseLabels = candidates.length > 24;

  useEffect(() => {
    const wheelGroup = wheelGroupRef.current;

    if (
      !wheelGroup ||
      !isSpinning ||
      visualPreviousRotation === visualRotation ||
      typeof wheelGroup.animate !== "function"
    ) {
      return;
    }

    const distance = visualRotation - visualPreviousRotation;

    try {
      const animation = wheelGroup.animate(
        reducedMotion
          ? [
              { transform: `rotate(${visualPreviousRotation}deg)` },
              { transform: `rotate(${visualRotation}deg)` },
            ]
          : [
              {
                transform: `rotate(${visualPreviousRotation}deg)`,
                easing: "cubic-bezier(0.4, 0, 0.8, 0.35)",
              },
              {
                offset: 0.12,
                transform: `rotate(${visualPreviousRotation + distance * 0.06}deg)`,
                easing: "cubic-bezier(0.18, 0.72, 0.18, 1)",
              },
              {
                offset: 0.62,
                transform: `rotate(${visualPreviousRotation + distance * 0.78}deg)`,
                easing: "cubic-bezier(0.12, 0.62, 0.08, 1)",
              },
              { transform: `rotate(${visualRotation}deg)` },
            ],
        {
          duration,
          fill: "none",
        },
      );

      return () => animation.cancel();
    } catch {
      onAnimationError?.();
      return;
    }
  }, [
    duration,
    isSpinning,
    onAnimationError,
    reducedMotion,
    visualPreviousRotation,
    visualRotation,
  ]);

  return (
    <div className="wheel-stage">
      <svg
        className={`wheel-stage__svg${
          hasDenseLabels ? " wheel-stage__svg--dense" : ""
        }`}
        viewBox="0 0 240 240"
        role="img"
        aria-label={`후보 ${candidates.length}개의 돌림판. ${statusLabel}`}
      >
        <title>{`후보 ${candidates.length}개의 돌림판`}</title>
        <g
          ref={wheelGroupRef}
          data-testid="wheel-disc"
          className="wheel-stage__disc"
          style={{
            transform: `rotate(${visualRotation}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transitionDuration: isSpinning ? `${duration}ms` : "0ms",
          }}
        >
          {segments.map((segment) => {
            const candidate = candidates[segment.index];
            const labelPoint = pointOnCircle(
              hasDenseLabels ? DENSE_LABEL_RADIUS : LABEL_RADIUS,
              segment.centerAngle,
            );

            return (
              <g key={candidate.id} data-candidate-id={candidate.id}>
                <title>{`${segment.index + 1}. ${candidate.name}`}</title>
                <path
                  d={createSegmentPath(
                    segment.startAngle,
                    segment.endAngle,
                  )}
                  fill={SEGMENT_COLORS[segment.index % SEGMENT_COLORS.length]}
                  stroke="white"
                  strokeWidth="1.2"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  transform={`rotate(${readableLabelRotation(
                    segment.centerAngle,
                  )} ${labelPoint.x} ${labelPoint.y})`}
                  aria-hidden="true"
                >
                  {segmentLabel(
                    candidate.name,
                    candidates.length,
                    segment.index,
                  )}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r="12" className="wheel-stage__hub" />
        </g>
        <polygon
          className="wheel-stage__pointer"
          points="120,5 108,29 132,29"
          aria-hidden="true"
        />
      </svg>
    </div>
  );
}
