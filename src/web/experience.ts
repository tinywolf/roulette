export type DrawExperienceType = "lottery" | "wheel";

export type DrawExperienceMetadata = {
  type: DrawExperienceType;
  label: string;
  description: string;
};

/** 셸이 표시할 추첨기 이름과 설명만 제공하는 메타데이터다. */
export const DRAW_EXPERIENCES: readonly DrawExperienceMetadata[] = [
  {
    type: "lottery",
    label: "로또 추첨기",
    description: "공을 섞어 한 번씩 제외하며 순서를 추첨합니다.",
  },
  {
    type: "wheel",
    label: "돌림판 추첨기",
    description: "같은 후보도 다시 당첨될 수 있는 돌림판을 돌립니다.",
  },
];

export function toExperienceHash(type: DrawExperienceType | null): string {
  return type ? `#/${type}` : "#/";
}

export function isKnownExperienceHash(hash: string): boolean {
  return (
    hash === "" ||
    hash === "#" ||
    hash === "#/" ||
    hash === "#/lottery" ||
    hash === "#/wheel"
  );
}

export function parseExperienceHash(
  hash: string,
): DrawExperienceType | null {
  if (hash === "#/lottery") {
    return "lottery";
  }

  if (hash === "#/wheel") {
    return "wheel";
  }

  return null;
}
