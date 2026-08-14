import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findWebFeatureImportFailures } from "./web-feature-boundaries.mjs";

const webRoot = "/workspace/src/web";

function verify(importer, specifier) {
  return findWebFeatureImportFailures({ importer, specifier, webRoot });
}

describe("web feature boundaries", () => {
  it("셸에서 기능 공개 진입점만 허용한다", () => {
    const importer = `${webRoot}/App.tsx`;

    assert.deepEqual(verify(importer, "./features/lottery"), []);
    assert.deepEqual(verify(importer, "./features/wheel/index"), []);
    assert.equal(
      verify(importer, "./features/lottery/domain/drawEngine").length,
      1,
    );
  });

  it("같은 기능 내부와 공유 계층 의존성을 허용한다", () => {
    const importer = `${webRoot}/features/lottery/components/LotteryApp.tsx`;

    assert.deepEqual(verify(importer, "../domain/drawEngine"), []);
    assert.deepEqual(verify(importer, "../../../shared/components/ToastStack"), []);
  });

  it("추첨기 기능 간 교차 의존성을 거부한다", () => {
    const importer = `${webRoot}/features/lottery/components/LotteryApp.tsx`;
    const failures = verify(importer, "../../wheel/domain/wheelSession");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /lottery -> wheel/);
  });

  it("기능에서 셸로 향하는 역방향 의존성을 거부한다", () => {
    const importer = `${webRoot}/features/wheel/components/WheelApp.tsx`;
    const failures = verify(importer, "../../../App");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /셸 역방향/);
  });

  it("공유 계층에서 특정 추첨기 기능 의존성을 거부한다", () => {
    const importer = `${webRoot}/shared/components/ToastStack.tsx`;
    const failures = verify(importer, "../../features/wheel/domain/wheelSession");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /web\/shared/);
  });

  it("외부 패키지와 웹 밖 파일은 웹 기능 규칙 대상에서 제외한다", () => {
    assert.deepEqual(verify(`${webRoot}/App.tsx`, "react"), []);
    assert.deepEqual(
      verify("/workspace/src/core/random.ts", "../web/features/wheel"),
      [],
    );
  });
});
