import { parseNames } from "../../../../core/input";
import {
  createWheelCandidates,
  type WheelCandidate,
} from "./wheelSession";

export type ParsedWheelInput = {
  names: string[];
  candidates: WheelCandidate[];
  errors: string[];
};

/** 공통 후보 문법을 돌림판의 안정적인 구획 ID로 변환한다. */
export function parseWheelInput(rawInput: string): ParsedWheelInput {
  const parsed = parseNames(rawInput);

  return {
    names: parsed.names,
    candidates: parsed.errors.length
      ? []
      : createWheelCandidates(parsed.names),
    errors: parsed.errors,
  };
}
