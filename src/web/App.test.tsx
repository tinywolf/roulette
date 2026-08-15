import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { EXPERIENCE_STORAGE_KEY } from "./experienceStorage";

describe("추첨기 선택 셸", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "#/");
  });

  it("기본 주소에서 두 추첨기를 선택할 수 있다", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "어떤 추첨기를 사용할까요?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    ).toBeInTheDocument();
  });

  it("선택한 추첨기에 맞춰 브라우저 타이틀을 변경한다", () => {
    render(<App />);

    expect(document.title).toBe("추첨기 선택");

    fireEvent.click(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    );
    expect(document.title).toBe("로또 추첨기");

    fireEvent.click(
      screen.getByRole("button", { name: /다른 추첨기 선택/ }),
    );
    expect(document.title).toBe("추첨기 선택");

    fireEvent.click(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    );
    expect(document.title).toBe("돌림판 추첨기");
  });

  it("키보드로 추첨기를 선택할 수 있다", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(window.location.hash).toBe("#/wheel");
    expect(
      screen.getByRole("heading", { name: "돌려 돌려, 돌림판" }),
    ).toBeInTheDocument();
  });

  it("로또를 공개 진입점으로 마운트하고 선택 화면으로 돌아온다", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    );

    expect(window.location.hash).toBe("#/lottery");
    expect(
      screen.getByRole("heading", { name: "어떤 공을 넣어볼까요?" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /다른 추첨기 선택/ }),
    );

    expect(window.location.hash).toBe("#/");
    expect(
      screen.getByRole("heading", { name: "어떤 추첨기를 사용할까요?" }),
    ).toBeInTheDocument();
  });

  it("기능을 전환해도 로또와 돌림판의 입력·옵션을 서로 분리해 복원한다", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    );
    fireEvent.change(screen.getByLabelText("공 이름"), {
      target: { value: "로또 민지, 로또 준호" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /자동 추첨/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /다른 추첨기 선택/ }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    );
    fireEvent.change(screen.getByLabelText("돌림판 후보"), {
      target: { value: "돌림판 서연, 돌림판 지우" },
    });
    fireEvent.click(screen.getByRole("button", { name: "효과음 꺼짐" }));
    fireEvent.click(
      screen.getByRole("button", { name: /다른 추첨기 선택/ }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "로또 추첨기 선택" }),
    );
    expect(screen.getByLabelText("공 이름")).toHaveValue(
      "로또 민지, 로또 준호",
    );
    expect(screen.getByRole("radio", { name: /자동 추첨/ })).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: /다른 추첨기 선택/ }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    );
    expect(screen.getByLabelText("돌림판 후보")).toHaveValue(
      "돌림판 서연, 돌림판 지우",
    );
    expect(screen.getByRole("button", { name: "효과음 켜짐" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("lottery-draw:names:v1")).toContain(
      "로또 민지",
    );
    expect(localStorage.getItem("wheel-draw:candidates:v1")).toContain(
      "돌림판 서연",
    );
  });

  it("돌림판 직접 주소에서도 뒤로 가기로 선택 화면에 복귀한다", async () => {
    window.history.replaceState(null, "", "#/wheel");
    render(<App />);

    expect(document.title).toBe("돌림판 추첨기");
    expect(
      screen.getByRole("heading", { name: "돌려 돌려, 돌림판" }),
    ).toBeInTheDocument();

    act(() => window.history.back());

    await waitFor(() => {
      expect(window.location.hash).toBe("#/");
      expect(document.title).toBe("추첨기 선택");
      expect(
        screen.getByRole("heading", { name: "어떤 추첨기를 사용할까요?" }),
      ).toBeInTheDocument();
    });
  });

  it("마지막 선택은 자동 진입하지 않고 해당 카드만 강조한다", () => {
    localStorage.setItem(
      EXPERIENCE_STORAGE_KEY,
      JSON.stringify({ version: 1, type: "wheel" }),
    );

    render(<App />);

    expect(window.location.hash).toBe("#/");
    expect(screen.getByText("마지막 선택")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "돌림판 추첨기 선택" }),
    ).toHaveClass("experience-card--last");
  });

  it("알 수 없는 주소와 손상된 선택값을 선택 화면으로 복구한다", async () => {
    window.history.replaceState(null, "", "#/unknown");
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, "{bad json");

    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/"));
    expect(
      screen.getByRole("heading", { name: "어떤 추첨기를 사용할까요?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "마지막 추첨기 선택을 불러오지 못했습니다.",
    );
  });
});
