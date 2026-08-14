import { Component, type ErrorInfo, type ReactNode } from "react";

type ExperienceErrorBoundaryProps = {
  children: ReactNode;
  onReturnToSelector: () => void;
};

type ExperienceErrorBoundaryState = {
  hasError: boolean;
};

/** 한 추첨기의 렌더링 실패가 선택 셸과 다른 추첨기로 전파되지 않게 격리한다. */
export class ExperienceErrorBoundary extends Component<
  ExperienceErrorBoundaryProps,
  ExperienceErrorBoundaryState
> {
  state: ExperienceErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ExperienceErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 사용자 입력이나 기능 저장값을 변경하지 않고 셸의 복귀 경로만 제공한다.
  }

  private returnToSelector = (): void => {
    this.setState({ hasError: false });
    this.props.onReturnToSelector();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="experience-error" role="alert">
          <p className="experience-error__eyebrow">DRAW ERROR</p>
          <h1>추첨기를 표시하지 못했습니다.</h1>
          <p>선택 화면으로 돌아가 다른 추첨기를 이용해 주세요.</p>
          <button type="button" onClick={this.returnToSelector}>
            추첨기 선택으로 돌아가기
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
