import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDrawOrder,
  secureRandomIndex,
  SecureRandomError,
  webCryptoRandomValues,
  type RandomValuesSource,
} from "./random";

function sequenceSource(...values: number[]): RandomValuesSource {
  return (target) => {
    const value = values.shift();

    if (value === undefined) {
      throw new Error("테스트 난수 값이 부족합니다.");
    }

    target[0] = value;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("core secure random", () => {
  it("거부 구간의 값을 버리고 편향 없는 인덱스를 다시 뽑는다", () => {
    expect(secureRandomIndex(3, sequenceSource(0xffff_ffff, 4))).toBe(1);
  });

  it("난수 소스 오류를 SecureRandomError로 변환한다", () => {
    expect(() =>
      secureRandomIndex(2, () => {
        throw new Error("원시 난수 오류");
      }),
    ).toThrow(SecureRandomError);
  });

  it("Web Crypto가 없으면 낮은 품질의 난수로 대체하지 않는다", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => webCryptoRandomValues(new Uint32Array(1))).toThrow(
      SecureRandomError,
    );
  });

  it("Fisher–Yates 순서에 모든 후보 ID를 정확히 한 번 포함한다", () => {
    const candidates = ["가", "나", "다", "라"].map((name, index) => ({
      id: `candidate-${index + 1}`,
      name,
    }));
    const order = createDrawOrder(candidates, sequenceSource(0, 1, 0));

    expect(order).toHaveLength(candidates.length);
    expect(new Set(order)).toEqual(new Set(candidates.map(({ id }) => id)));
  });
});
