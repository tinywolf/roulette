import { describe, expect, it } from "vitest";
import {
  getSegmentCenterAngle,
  getTargetRotation,
  getWheelSegments,
  normalizeAngle,
} from "./wheelGeometry";

describe("wheelGeometry", () => {
  it("후보 수에 따라 동일한 구획과 중심각을 계산한다", () => {
    expect(getWheelSegments(2)).toEqual([
      { index: 0, startAngle: 0, endAngle: 180, centerAngle: 90 },
      { index: 1, startAngle: 180, endAngle: 360, centerAngle: 270 },
    ]);

    const segments = getWheelSegments(45);
    expect(segments).toHaveLength(45);
    expect(segments[0]).toEqual({
      index: 0,
      startAngle: 0,
      endAngle: 8,
      centerAngle: 4,
    });
    expect(segments[44]).toEqual({
      index: 44,
      startAngle: 352,
      endAngle: 360,
      centerAngle: 356,
    });
  });

  it("첫 후보와 마지막 후보의 중심각을 구분한다", () => {
    expect(getSegmentCenterAngle(0, 4)).toBe(45);
    expect(getSegmentCenterAngle(3, 4)).toBe(315);
  });

  it("최소 6회 순방향 회전 후 목표 중심을 상단 포인터에 맞춘다", () => {
    const target = getTargetRotation({
      currentRotation: 0,
      candidateIndex: 0,
      candidateCount: 4,
      pointerAngle: 0,
      minimumFullRotations: 6,
    });

    expect(target).toBe(2_475);
    expect(target).toBeGreaterThanOrEqual(6 * 360);
    expect(
      normalizeAngle(getSegmentCenterAngle(0, 4) + target),
    ).toBe(0);
  });

  it("누적 회전각에서 역회전하지 않고 다음 목표를 계산한다", () => {
    const currentRotation = 2_205;
    const target = getTargetRotation({
      currentRotation,
      candidateIndex: 0,
      candidateCount: 4,
      pointerAngle: 0,
      minimumFullRotations: 6,
    });

    expect(target).toBe(4_635);
    expect(target - currentRotation).toBeGreaterThanOrEqual(6 * 360);
    expect(
      normalizeAngle(getSegmentCenterAngle(0, 4) + target),
    ).toBe(0);
  });

  it("0/360도 정렬 상태에서도 현재 각도보다 큰 값을 반환한다", () => {
    const target = getTargetRotation({
      currentRotation: 315,
      candidateIndex: 0,
      candidateCount: 4,
      pointerAngle: 0,
      minimumFullRotations: 6,
    });

    expect(target).toBe(2_475);
    expect(target).toBeGreaterThan(315);
  });

  it("45개 후보의 마지막 구획도 포인터 중심에 정확히 정렬한다", () => {
    const target = getTargetRotation({
      currentRotation: 11,
      candidateIndex: 44,
      candidateCount: 45,
      pointerAngle: 0,
      minimumFullRotations: 6,
    });

    expect(
      normalizeAngle(getSegmentCenterAngle(44, 45) + target),
    ).toBeCloseTo(0, 10);
    expect(target - 11).toBeGreaterThanOrEqual(6 * 360);
  });
});
