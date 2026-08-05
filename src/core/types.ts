/**
 * 웹 UI와 MCP 서버가 공유하는 룰렛 입력·추첨 데이터만 정의한다.
 * 색상, 애니메이션 시각, 세션 상태처럼 표현 계층에 종속된 값은 포함하지 않는다.
 */
export type Candidate = {
  id: string;
  name: string;
};

export type DrawnCandidate = {
  order: number;
  id: string;
  name: string;
};

export type DrawSelection = {
  candidateCount: number;
  drawCount: number;
  remainingCount: number;
  results: DrawnCandidate[];
};

export type ParseNamesResult = {
  names: string[];
  errors: string[];
};
