import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStack, type ToastMessage } from "./ToastStack";

function ToastStackHarness({
  initialToasts,
}: {
  initialToasts: ToastMessage[];
}) {
  const [toasts, setToasts] = useState(initialToasts);

  return (
    <ToastStack
      toasts={toasts}
      onDismiss={(id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }}
    />
  );
}

describe("ToastStack", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("여러 알림을 쌓고 지속 알림은 자동으로 닫지 않는다", () => {
    vi.useFakeTimers();
    render(
      <ToastStackHarness
        initialToasts={[
          {
            id: 1,
            key: "storage-warning",
            type: "warning",
            text: "설정을 저장하지 못했습니다.",
            duration: null,
          },
          {
            id: 2,
            key: "copy-result",
            type: "success",
            text: "추첨 결과를 복사했습니다.",
            duration: 3_000,
          },
        ]}
      />,
    );

    expect(screen.getAllByRole("status")).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText("추첨 결과를 복사했습니다.")).not
      .toBeInTheDocument();
    expect(screen.getByText("설정을 저장하지 못했습니다."))
      .toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "설정을 저장하지 못했습니다. 알림 닫기",
      }),
    );

    expect(screen.queryByLabelText("알림")).not.toBeInTheDocument();
  });
});
