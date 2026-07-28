import { describe, expect, it } from "vitest";
import {
  advanceBallMotionNode,
  createBallMotionNode,
  projectBallMotionNode,
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

  it("앞쪽 공을 뒤쪽 공보다 크고 선명하게 투영한다", () => {
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

    expect(front.radius).toBeGreaterThan(back.radius);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.x).toBeGreaterThan(back.x);
  });

  it("깊이가 다른 공은 같은 화면 좌표에 겹쳐 투영될 수 있다", () => {
    const back = projectBallMotionNode(
      createNode({ z: -60 }),
      120,
      80,
      100,
      12,
    );
    const front = projectBallMotionNode(
      createNode({ z: 60 }),
      120,
      80,
      100,
      12,
    );

    expect(front.x).toBe(back.x);
    expect(front.y).toBe(back.y);
    expect(front.radius).not.toBe(back.radius);
  });

  it("공을 구형 경계 안으로 되돌리고 바깥쪽 속도를 반사한다", () => {
    const node = createNode({ x: 120, vx: 80 });

    advanceBallMotionNode(node, 0, 0, 0, true, 100, 10);

    expect(Math.hypot(node.x, node.y, node.z)).toBeLessThanOrEqual(80.51);
    expect(node.vx).toBeLessThan(0);
  });

  it("혼합 중 깊이와 3축 속도를 계속 변화시킨다", () => {
    const node = createNode({ x: 30, y: -20, z: 10, vx: 20, vy: 5, vz: -4 });
    const previous = { z: node.z, vz: node.vz };

    advanceBallMotionNode(node, 3, 1_200, 0.016, true, 120, 10);

    expect(node.z).not.toBe(previous.z);
    expect(node.vz).not.toBe(previous.vz);
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
