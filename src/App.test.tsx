import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App, { shouldMixMachine } from "./App";

describe("machine motion state", () => {
  it("수동 준비·추첨 중에는 계속 혼합하고 완료 시 중단한다", () => {
    expect(shouldMixMachine({ mode: "manual", phase: "ready" })).toBe(true);
    expect(shouldMixMachine({ mode: "manual", phase: "mixing" })).toBe(true);
    expect(shouldMixMachine({ mode: "manual", phase: "completed" })).toBe(
      false,
    );
    expect(shouldMixMachine({ mode: "auto", phase: "running" })).toBe(true);
  });
});

describe("App setup", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("입력 검증 후 추첨을 시작한다", () => {
    render(<App />);
    const startButton = screen.getByRole("button", { name: /추첨 시작/ });
    const input = screen.getByLabelText("공 이름");

    expect(startButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "민지, 민지" } });
    expect(startButton).toBeEnabled();
    fireEvent.click(startButton);

    expect(screen.getByRole("heading", { name: "행운의 공을 기다려보세요" }))
      .toBeInTheDocument();
    expect(screen.getByText("0 / 2")).toBeInTheDocument();
  });

  it("입력 원문을 저장하고 모두 지운다", () => {
    render(<App />);
    const input = screen.getByLabelText("공 이름");

    fireEvent.change(input, { target: { value: "민지\n준호" } });
    expect(localStorage.getItem("lottery-draw:names:v1")).toContain("민지");

    fireEvent.click(screen.getByRole("button", { name: "모두 지우기" }));
    expect(input).toHaveValue("");
    expect(localStorage.getItem("lottery-draw:names:v1")).toBeNull();
  });

  it("새로 마운트하면 이름만 복원하고 설정 화면에서 시작한다", () => {
    const firstRender = render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));
    expect(screen.getByText("0 / 2")).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);

    expect(screen.getByRole("heading", { name: "추첨할 이름을 담아주세요" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("공 이름")).toHaveValue("민지, 준호");
    expect(screen.queryByText("0 / 2")).not.toBeInTheDocument();
  });

  it("45개까지 시작을 허용하고 46개는 차단한다", () => {
    render(<App />);
    const input = screen.getByLabelText("공 이름");
    const startButton = screen.getByRole("button", { name: /추첨 시작/ });
    const fortyFiveNames = Array.from(
      { length: 45 },
      (_, index) => `이름${index + 1}`,
    ).join(",");

    fireEvent.change(input, { target: { value: fortyFiveNames } });
    expect(screen.getByText("45 / 45")).toBeInTheDocument();
    expect(startButton).toBeEnabled();

    fireEvent.change(input, { target: { value: `${fortyFiveNames},이름46` } });
    expect(screen.getByText("46 / 45")).toBeInTheDocument();
    expect(startButton).toBeDisabled();
    expect(screen.getByText("이름은 최대 45개까지 입력할 수 있습니다."))
      .toBeInTheDocument();
  });

  it("1~45 숫자 범위를 45개의 공으로 확장해 시작한다", () => {
    render(<App />);
    const input = screen.getByLabelText("공 이름");

    fireEvent.change(input, { target: { value: "1~45" } });

    expect(screen.getByText("45 / 45")).toBeInTheDocument();
    expect(localStorage.getItem("lottery-draw:names:v1")).toContain("1~45");
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));

    expect(screen.getByText("0 / 45")).toBeInTheDocument();
    expect(screen.getByLabelText(/남은 공 45개/)).toBeInTheDocument();
  });

  it("숫자 범위와 일반 이름을 섞으면 시작을 차단한다", () => {
    render(<App />);
    const input = screen.getByLabelText("공 이름");
    const startButton = screen.getByRole("button", { name: /추첨 시작/ });

    fireEvent.change(input, { target: { value: "1~3,민지" } });

    expect(startButton).toBeDisabled();
    expect(screen.getByText(/숫자 두 개만 ~로 연결/)).toBeInTheDocument();
  });

  it("일부 추첨 개수를 검증하고 목표 개수로 세션을 시작한다", () => {
    render(<App />);
    const input = screen.getByLabelText("공 이름");
    const startButton = screen.getByRole("button", { name: /추첨 시작/ });
    const fortyFiveNames = Array.from(
      { length: 45 },
      (_, index) => `이름${index + 1}`,
    ).join(",");

    fireEvent.change(input, { target: { value: fortyFiveNames } });
    fireEvent.click(screen.getByRole("radio", { name: /일부만 추첨/ }));

    const drawCountInput = screen.getByLabelText("뽑을 공 개수");
    fireEvent.change(drawCountInput, { target: { value: "46" } });
    expect(startButton).toBeDisabled();
    expect(screen.getByText(/입력한 공 개수\(45개\)/)).toBeInTheDocument();

    fireEvent.change(drawCountInput, { target: { value: "6" } });
    expect(startButton).toBeEnabled();
    fireEvent.click(startButton);

    expect(screen.getByText("0 / 6")).toBeInTheDocument();
    expect(screen.getByLabelText(/남은 공 45개/)).toBeInTheDocument();
  });

  it("새로 마운트하면 추첨 개수 설정은 전체로 초기화한다", () => {
    const firstRender = render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "가, 나, 다" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /일부만 추첨/ }));
    fireEvent.change(screen.getByLabelText("뽑을 공 개수"), {
      target: { value: "1" },
    });

    firstRender.unmount();
    render(<App />);

    expect(screen.getByRole("radio", { name: /전체 추첨/ })).toBeChecked();
    expect(screen.queryByLabelText("뽑을 공 개수")).not.toBeInTheDocument();
  });
});

describe("manual draw flow", () => {
  it("혼합 시간 후 공을 한 번만 결과에 반영하고 설정으로 돌아간다", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));

    const drawButton = screen.getByRole("button", { name: /다음 공 뽑기/ });
    fireEvent.click(drawButton);
    fireEvent.click(drawButton);
    expect(screen.getByRole("button", { name: /공을 섞는 중/ })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2_400);
    });

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시" }));
    expect(screen.getByRole("heading", { name: "추첨할 이름을 담아주세요" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("공 이름")).toHaveValue("민지, 준호");
    vi.useRealTimers();
  });

  it("복사 실패 시 오류 알림만 표시한다", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음 공 뽑기/ }));

    act(() => {
      vi.advanceTimersByTime(2_400);
    });
    vi.useRealTimers();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("거부")),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "결과를 복사하지 못했습니다.",
      );
    });
    expect(screen.queryByRole("textbox", { name: /수동 복사/ })).not
      .toBeInTheDocument();
  });

  it("일부 추첨은 목표 개수에서 완료하고 나머지 공을 결과에서 제외한다", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "가, 나, 다" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /일부만 추첨/ }));
    fireEvent.change(screen.getByLabelText("뽑을 공 개수"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음 공 뽑기/ }));

    act(() => {
      vi.advanceTimersByTime(2_400);
    });

    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "추첨이 완료됐어요" }))
      .toBeInTheDocument();
    expect(screen.getByText("선택한 1개의 공을 모두 뽑았어요."))
      .toBeInTheDocument();
    expect(screen.getByLabelText(/남은 공 2개/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("결과를 순서 텍스트로 복사하고 성공을 알린다", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음 공 뽑기/ }));
    act(() => {
      vi.advanceTimersByTime(2_400);
    });
    vi.useRealTimers();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^1\. /));
      expect(screen.getByRole("status")).toHaveTextContent(
        "추첨 결과를 복사했습니다.",
      );
    });
  });
});

describe("automatic draw flow", () => {
  it("카운트다운 없이 3초부터 순서대로 자동 추첨한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const randomSpy = vi
      .spyOn(globalThis.crypto, "getRandomValues")
      .mockImplementation(((values: Uint32Array<ArrayBuffer>) => {
        values[0] = 0;
        return values;
      }) as typeof globalThis.crypto.getRandomValues);

    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /자동 추첨/ }));
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));

    expect(screen.queryByText(/초 남음|카운트다운/)).not.toBeInTheDocument();
    expect(screen.getByText("0 / 2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(screen.getByText("0 / 2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "추첨이 완료됐어요" }))
      .toBeInTheDocument();

    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  it("일부 자동 추첨은 목표 개수의 일정만 실행한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const randomSpy = vi
      .spyOn(globalThis.crypto, "getRandomValues")
      .mockImplementation(((values: Uint32Array<ArrayBuffer>) => {
        values[0] = 0;
        return values;
      }) as typeof globalThis.crypto.getRandomValues);

    render(<App />);
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "가, 나, 다" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /일부만 추첨/ }));
    fireEvent.change(screen.getByLabelText("뽑을 공 개수"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /자동 추첨/ }));
    fireEvent.click(screen.getByRole("button", { name: /추첨 시작/ }));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByLabelText(/남은 공 2개/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "추첨이 완료됐어요" }))
      .toBeInTheDocument();

    randomSpy.mockRestore();
    vi.useRealTimers();
  });
});
