export const BALL_COLORS = [
  "#ff6b6b",
  "#ffb84d",
  "#ffd43b",
  "#51cf66",
  "#4dabf7",
  "#748ffc",
  "#b197fc",
  "#f783ac",
  "#38d9a9",
  "#ffa94d",
] as const;

export type Ball = {
  id: string;
  name: string;
  color: string;
};

export type DrawMode = "manual" | "auto";

export type DrawCountMode = "all" | "custom";

export type RenderMode = "2d" | "3d";

export type DrawPhase =
  | "setup"
  | "ready"
  | "mixing"
  | "running"
  | "completed"
  | "error";

export type DrawResult = {
  order: number;
  ballId: string;
  name: string;
  drawnAt: number;
};

export type ScheduledDraw = {
  order: number;
  ballId: string;
  dueAt: number;
};

export type DrawSession = {
  mode: DrawMode;
  drawCount: number;
  phase: DrawPhase;
  balls: Ball[];
  remainingBallIds: string[];
  results: DrawResult[];
  schedule: ScheduledDraw[];
  startedAt: number | null;
  pendingBallId: string | null;
  error: string | null;
};

export type { ParseNamesResult } from "../../core/types";

export function createBalls(names: string[]): Ball[] {
  return names.map((name, index) => ({
    id: `ball-${index + 1}`,
    name,
    color: BALL_COLORS[index % BALL_COLORS.length],
  }));
}
