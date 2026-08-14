import { describe, expect, it } from "vitest";
import {
  applyFinalSettlingTransition,
  advanceBallMotionNode,
  advanceSettlingBallMotionNodes,
  createBallMotionNode,
  createFinalSettlingTransition,
  forceSettleBallMotionNodes,
  projectBallMotionNode,
  projectBallMotionNode3d,
  scaleBallMotionNode,
  type BallMotionNode,
} from "./lotteryMotion";

function createNode(overrides: Partial<BallMotionNode> = {}): BallMotionNode {
  return {
    id: "ball-1",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    ...overrides,
  };
}

describe("lotteryMotion", () => {
  it("초기 공을 서로 다른 깊이를 가진 구형 공간 안에 배치한다", () => {
    const nodes = Array.from({ length: 45 }, (_, index) =>
      createBallMotionNode(`ball-${index + 1}`, index, 45, 100),
    );

    expect(
      nodes.every((node) => Math.hypot(node.x, node.y, node.z) < 100),
    ).toBe(true);
    expect(new Set(nodes.map((node) => Math.round(node.z))).size).toBeGreaterThan(
      20,
    );
  });

  it("깊이와 관계없이 같은 크기로 투영하되 앞쪽 공을 더 선명하게 표시한다", () => {
    const back = projectBallMotionNode(
      createNode({ x: 20, y: 10, z: -80 }),
      100,
      100,
      100,
      12,
    );
    const front = projectBallMotionNode(
      createNode({ x: 20, y: 10, z: 80 }),
      100,
      100,
      100,
      12,
    );

    expect(front.radius).toBe(back.radius);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.x).toBeGreaterThan(back.x);
  });

  it("3D 투영은 앞쪽 공을 더 크고 멀리 배치한다", () => {
    const back = projectBallMotionNode3d(
      createNode({ x: 20, y: 10, z: -70 }),
      100,
      100,
      100,
      12,
    );
    const front = projectBallMotionNode3d(
      createNode({ x: 20, y: 10, z: 70 }),
      100,
      100,
      100,
      12,
    );

    expect(front.radius).toBeGreaterThan(back.radius);
    expect(front.x).toBeGreaterThan(back.x);
    expect(front.y).toBeGreaterThan(back.y);
    expect(front.opacity).toBeGreaterThan(back.opacity);
  });

  it("공을 구형 경계 안으로 되돌리고 바깥쪽 속도를 반사한다", () => {
    const node = createNode({ x: 120, vx: 80 });

    advanceBallMotionNode(node, 0, 0, 0, true, 100, 10);

    expect(Math.hypot(node.x, node.y, node.z)).toBeLessThanOrEqual(80.51);
    expect(node.vx).toBeLessThan(0);
  });

  it("여러 공이 서로 다른 시점에 중앙을 통과해 고리 궤도에 고착되지 않는다", () => {
    const nodes = Array.from({ length: 45 }, (_, index) =>
      createBallMotionNode(`ball-${index + 1}`, index, 45, 120),
    );
    const initialDepthStates = nodes.map(({ z, vz }) => ({ z, vz }));
    const centralVisitors = new Set<string>();
    let mixedDepthFrameCount = 0;

    for (let frame = 0; frame < 360; frame += 1) {
      let centralCount = 0;
      let outerCount = 0;

      nodes.forEach((node, index) => {
        advanceBallMotionNode(
          node,
          index,
          frame * (1_000 / 60),
          1 / 60,
          true,
          120,
          10,
        );

        const planarDistance = Math.hypot(node.x, node.y);

        if (planarDistance < 30) {
          centralVisitors.add(node.id);
          centralCount += 1;
        } else if (planarDistance > 72) {
          outerCount += 1;
        }
      });

      if (centralCount > 0 && outerCount > 0) {
        mixedDepthFrameCount += 1;
      }
    }

    expect(centralVisitors.size).toBeGreaterThan(15);
    expect(mixedDepthFrameCount).toBeGreaterThan(120);
    expect(
      nodes.some(
        (node, index) =>
          node.z !== initialDepthStates[index].z &&
          node.vz !== initialDepthStates[index].vz,
      ),
    ).toBe(true);
  });

  it("완료 후 공을 중력으로 구형 바닥에 떨어뜨려 정지시킨다", () => {
    const node = createNode({
      y: -72,
      vx: 18,
      vy: -24,
      vz: 12,
    });

    for (let frame = 0; frame < 360; frame += 1) {
      advanceSettlingBallMotionNodes([node], 1 / 60, 100, 10);
    }

    expect(node.y).toBeGreaterThan(72);
    expect(Math.hypot(node.x, node.y, node.z)).toBeLessThanOrEqual(80.51);
    expect(Math.hypot(node.vx, node.vy, node.vz)).toBeLessThan(1);
  });

  it("공중의 느린 공은 잠들지 않고 정상 중력으로 낙하한다", () => {
    const node = createNode({ y: -60 });

    advanceSettlingBallMotionNodes([node], 1 / 60, 100, 10);

    expect(node.y).toBeGreaterThan(-60);
    expect(node.vy).toBeGreaterThan(0);
  });

  it("하드 리밋에서는 마지막 겹침을 보정하고 모든 공을 고정한다", () => {
    const nodes = Array.from({ length: 4 }, (_, index) =>
      createNode({ id: `ball-${index + 1}`, y: -30 }),
    );

    forceSettleBallMotionNodes(nodes, 100, 10);

    let minimumDistance = Number.POSITIVE_INFINITY;

    nodes.forEach((node, firstIndex) => {
      expect(node.y).toBeGreaterThan(0);
      expect(Math.hypot(node.vx, node.vy, node.vz)).toBe(0);

      nodes.slice(firstIndex + 1).forEach((other) => {
        minimumDistance = Math.min(
          minimumDistance,
          Math.hypot(
            node.x - other.x,
            node.y - other.y,
            node.z - other.z,
          ),
        );
      });
    });

    expect(minimumDistance).toBeGreaterThan(19);
  });

  it("하드 리밋 직전에는 현재 위치에서 최종 위치까지 여러 프레임에 걸쳐 이동한다", () => {
    const nodes = Array.from({ length: 12 }, (_, index) =>
      createBallMotionNode(`ball-${index + 1}`, index, 12, 100),
    );
    const transition = createFinalSettlingTransition(nodes, 100, 10);
    const initialPositions = nodes.map(({ x, y, z }) => ({ x, y, z }));
    let maximumFrameDisplacement = 0;
    let previousPositions = initialPositions;

    for (let frame = 0; frame <= 60; frame += 1) {
      applyFinalSettlingTransition(
        nodes,
        transition,
        frame / 60,
        1_000,
      );

      maximumFrameDisplacement = Math.max(
        maximumFrameDisplacement,
        ...nodes.map((node, index) =>
          Math.hypot(
            node.x - previousPositions[index].x,
            node.y - previousPositions[index].y,
            node.z - previousPositions[index].z,
          ),
        ),
      );
      previousPositions = nodes.map(({ x, y, z }) => ({ x, y, z }));
    }

    expect(maximumFrameDisplacement).toBeLessThan(6);
    nodes.forEach((node, index) => {
      expect(node).toMatchObject(transition.targets[index]);
      expect(Math.hypot(node.vx, node.vy, node.vz)).toBe(0);
    });
  });

  it("완료 후 44개 공의 겹침을 해소하며 아래쪽에 쌓는다", () => {
    const nodes = Array.from({ length: 44 }, (_, index) =>
      createBallMotionNode(`ball-${index + 1}`, index, 44, 120),
    );

    for (let frame = 0; frame < 600; frame += 1) {
      advanceSettlingBallMotionNodes(nodes, 1 / 60, 120, 10);
    }

    const averageY =
      nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
    let minimumDistance = Number.POSITIVE_INFINITY;

    nodes.forEach((node, firstIndex) => {
      expect(Math.hypot(node.x, node.y, node.z)).toBeLessThanOrEqual(100.51);

      nodes.slice(firstIndex + 1).forEach((other) => {
        minimumDistance = Math.min(
          minimumDistance,
          Math.hypot(
            node.x - other.x,
            node.y - other.y,
            node.z - other.z,
          ),
        );
      });
    });

    expect(averageY).toBeGreaterThan(42);
    expect(minimumDistance).toBeGreaterThan(19);
  });

  it("리사이즈 시 3축 위치와 속도를 같은 비율로 조정한다", () => {
    const node = createNode({
      x: 10,
      y: 20,
      z: 30,
      vx: 40,
      vy: 50,
      vz: 60,
    });

    scaleBallMotionNode(node, 0.5);

    expect(node).toMatchObject({
      x: 5,
      y: 10,
      z: 15,
      vx: 20,
      vy: 25,
      vz: 30,
    });
  });
});
