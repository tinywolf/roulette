import { useEffect, useRef } from "react";
import type { Ball, RenderMode } from "../domain/types";
import {
  Lottery3dRenderer,
  type Lottery3dFrameBall,
} from "./lottery3dRenderer";
import {
  advanceBallMotionNode,
  advanceSettlingBallMotionNodes,
  createBallMotionNode,
  projectBallMotionNode,
  projectBallMotionNode3d,
  scaleBallMotionNode,
  type BallMotionNode,
  type ProjectedBallNode,
} from "./lotteryMotion";

type LotteryMachineProps = {
  balls: Ball[];
  renderMode: RenderMode;
  isMixing: boolean;
  isSettling: boolean;
  visualBall: Ball | null;
  onError: (message: string) => void;
};

const CANVAS_ERROR =
  "추첨기 연출을 표시하지 못했습니다. 추첨 결과는 계속 정확하게 처리됩니다.";
const WEBGL_ERROR =
  "3D 연출을 사용할 수 없어 간단한 화면으로 표시합니다. 추첨 결과에는 영향이 없습니다.";

function displayName(
  context: CanvasRenderingContext2D,
  name: string,
  maximumWidth: number,
): string {
  if (context.measureText(name).width <= maximumWidth) {
    return name;
  }

  let sliced = name;

  while (sliced.length > 1) {
    sliced = sliced.slice(0, -1);
    const candidate = `${sliced}…`;

    if (context.measureText(candidate).width <= maximumWidth) {
      return candidate;
    }
  }

  return "…";
}

function drawBall(
  context: CanvasRenderingContext2D,
  ball: Ball,
  x: number,
  y: number,
  radius: number,
  opacity = 1,
): void {
  context.save();
  context.globalAlpha = opacity;
  context.shadowColor = "rgb(25 35 60 / 24%)";
  context.shadowBlur = radius * 0.35;
  context.shadowOffsetY = radius * 0.18;

  const gradient = context.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.45,
    radius * 0.08,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, ball.color);
  gradient.addColorStop(1, ball.color);

  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = Math.max(1.5, radius * 0.065);
  context.strokeStyle = "rgb(255 255 255 / 72%)";
  context.stroke();

  context.fillStyle = "#172033";
  context.font = `800 ${Math.max(7, radius * 0.42)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    displayName(context, ball.name, radius * 1.45),
    x,
    y + 1,
  );
  context.restore();
}

function drawMotionTrail(
  context: CanvasRenderingContext2D,
  ball: Ball,
  node: BallMotionNode,
  projected: ProjectedBallNode,
): void {
  const planarSpeed = Math.hypot(node.vx, node.vy);

  if (planarSpeed < 24) {
    return;
  }

  const trailLength = Math.min(
    projected.radius * 3.2,
    planarSpeed * projected.perspective * 0.055,
  );

  context.save();
  context.globalAlpha = projected.opacity * 0.16;
  context.strokeStyle = ball.color;
  context.lineWidth = Math.max(1.5, projected.radius * 0.16);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(
    projected.x - (node.vx / planarSpeed) * trailLength,
    projected.y - (node.vy / planarSpeed) * trailLength,
  );
  context.lineTo(projected.x, projected.y);
  context.stroke();
  context.restore();
}

/**
 * 실제 구의 투영선을 그리는 대신 투명도·면 음영·반사광으로 유리구의 부피를 표현한다.
 * 배경 레이어는 공을 가리지 않도록 옅게 유지한다.
 */
function drawGlassChamberBackground(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  chamberRadius: number,
): void {
  const chamberGradient = context.createRadialGradient(
    centerX - chamberRadius * 0.28,
    centerY - chamberRadius * 0.36,
    chamberRadius * 0.02,
    centerX + chamberRadius * 0.06,
    centerY + chamberRadius * 0.08,
    chamberRadius,
  );
  chamberGradient.addColorStop(0, "rgb(255 255 255 / 13%)");
  chamberGradient.addColorStop(0.52, "rgb(229 243 248 / 10%)");
  chamberGradient.addColorStop(0.78, "rgb(198 226 235 / 13%)");
  chamberGradient.addColorStop(0.94, "rgb(139 190 209 / 18%)");
  chamberGradient.addColorStop(1, "rgb(96 155 183 / 23%)");

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, chamberRadius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = chamberGradient;
  context.fillRect(
    centerX - chamberRadius,
    centerY - chamberRadius,
    chamberRadius * 2,
    chamberRadius * 2,
  );

  const lowerTint = context.createRadialGradient(
    centerX,
    centerY + chamberRadius * 0.88,
    0,
    centerX,
    centerY + chamberRadius * 0.88,
    chamberRadius * 0.82,
  );
  lowerTint.addColorStop(0, "rgb(255 255 255 / 24%)");
  lowerTint.addColorStop(0.33, "rgb(213 246 253 / 10%)");
  lowerTint.addColorStop(1, "rgb(255 255 255 / 0%)");
  context.fillStyle = lowerTint;
  context.fillRect(
    centerX - chamberRadius,
    centerY - chamberRadius,
    chamberRadius * 2,
    chamberRadius * 2,
  );

  const sideShade = context.createLinearGradient(
    centerX - chamberRadius,
    centerY,
    centerX + chamberRadius,
    centerY,
  );
  sideShade.addColorStop(0, "rgb(83 150 178 / 8%)");
  sideShade.addColorStop(0.18, "rgb(255 255 255 / 0%)");
  sideShade.addColorStop(0.72, "rgb(255 255 255 / 0%)");
  sideShade.addColorStop(1, "rgb(43 92 126 / 9%)");
  context.fillStyle = sideShade;
  context.fillRect(
    centerX - chamberRadius,
    centerY - chamberRadius,
    chamberRadius * 2,
    chamberRadius * 2,
  );
  context.restore();
}

/**
 * 공 위에 가장자리 음영과 반사광을 합성해 외곽선 없이 투명 구의 표면을 표현한다.
 * 반사광은 레퍼런스처럼 위·아래로 나누어 내부 공의 이름을 가리지 않는다.
 */
function drawGlassChamberForeground(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  chamberRadius: number,
): void {
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, chamberRadius, 0, Math.PI * 2);
  context.clip();

  const fresnelVeil = context.createRadialGradient(
    centerX - chamberRadius * 0.04,
    centerY - chamberRadius * 0.06,
    chamberRadius * 0.5,
    centerX,
    centerY,
    chamberRadius,
  );
  fresnelVeil.addColorStop(0, "rgb(255 255 255 / 0%)");
  fresnelVeil.addColorStop(0.62, "rgb(228 247 252 / 3%)");
  fresnelVeil.addColorStop(0.84, "rgb(176 218 231 / 6%)");
  fresnelVeil.addColorStop(0.96, "rgb(117 174 197 / 12%)");
  fresnelVeil.addColorStop(1, "rgb(83 139 166 / 17%)");
  context.fillStyle = fresnelVeil;
  context.fillRect(
    centerX - chamberRadius,
    centerY - chamberRadius,
    chamberRadius * 2,
    chamberRadius * 2,
  );

  const upperReflection = context.createLinearGradient(
    centerX,
    centerY - chamberRadius * 0.9,
    centerX,
    centerY - chamberRadius * 0.12,
  );
  upperReflection.addColorStop(0, "rgb(255 255 255 / 64%)");
  upperReflection.addColorStop(0.48, "rgb(255 255 255 / 28%)");
  upperReflection.addColorStop(1, "rgb(255 255 255 / 3%)");

  context.save();
  context.shadowColor = "rgb(255 255 255 / 44%)";
  context.shadowBlur = chamberRadius * 0.045;
  context.beginPath();
  context.moveTo(
    centerX - chamberRadius * 0.71,
    centerY - chamberRadius * 0.36,
  );
  context.bezierCurveTo(
    centerX - chamberRadius * 0.5,
    centerY - chamberRadius * 0.83,
    centerX + chamberRadius * 0.3,
    centerY - chamberRadius * 0.95,
    centerX + chamberRadius * 0.65,
    centerY - chamberRadius * 0.42,
  );
  context.bezierCurveTo(
    centerX + chamberRadius * 0.3,
    centerY - chamberRadius * 0.64,
    centerX - chamberRadius * 0.4,
    centerY - chamberRadius * 0.58,
    centerX - chamberRadius * 0.71,
    centerY - chamberRadius * 0.36,
  );
  context.closePath();
  context.fillStyle = upperReflection;
  context.fill();
  context.restore();

  const smallHighlight = context.createRadialGradient(
    centerX - chamberRadius * 0.39,
    centerY - chamberRadius * 0.39,
    0,
    centerX - chamberRadius * 0.35,
    centerY - chamberRadius * 0.34,
    chamberRadius * 0.2,
  );
  smallHighlight.addColorStop(0, "rgb(255 255 255 / 70%)");
  smallHighlight.addColorStop(0.46, "rgb(255 255 255 / 32%)");
  smallHighlight.addColorStop(1, "rgb(255 255 255 / 0%)");
  context.save();
  context.shadowColor = "rgb(255 255 255 / 42%)";
  context.shadowBlur = chamberRadius * 0.035;
  context.beginPath();
  context.ellipse(
    centerX - chamberRadius * 0.34,
    centerY - chamberRadius * 0.32,
    chamberRadius * 0.13,
    chamberRadius * 0.18,
    0.32,
    0,
    Math.PI * 2,
  );
  context.fillStyle = smallHighlight;
  context.fill();
  context.restore();

  const lowerReflection = context.createLinearGradient(
    centerX,
    centerY + chamberRadius * 0.42,
    centerX,
    centerY + chamberRadius * 0.88,
  );
  lowerReflection.addColorStop(0, "rgb(255 255 255 / 2%)");
  lowerReflection.addColorStop(0.48, "rgb(255 255 255 / 22%)");
  lowerReflection.addColorStop(1, "rgb(255 255 255 / 48%)");
  context.save();
  context.shadowColor = "rgb(207 248 255 / 28%)";
  context.shadowBlur = chamberRadius * 0.04;
  context.beginPath();
  context.moveTo(
    centerX - chamberRadius * 0.58,
    centerY + chamberRadius * 0.55,
  );
  context.bezierCurveTo(
    centerX - chamberRadius * 0.32,
    centerY + chamberRadius * 0.88,
    centerX + chamberRadius * 0.3,
    centerY + chamberRadius * 0.91,
    centerX + chamberRadius * 0.58,
    centerY + chamberRadius * 0.57,
  );
  context.bezierCurveTo(
    centerX + chamberRadius * 0.26,
    centerY + chamberRadius * 0.72,
    centerX - chamberRadius * 0.27,
    centerY + chamberRadius * 0.72,
    centerX - chamberRadius * 0.58,
    centerY + chamberRadius * 0.55,
  );
  context.closePath();
  context.fillStyle = lowerReflection;
  context.fill();
  context.restore();

  context.restore();

}

/**
 * 3D 모드의 유리구 결합부와 받침을 타원·곡면 음영으로 구성한다.
 * 평면 사각형 대신 위에서 내려다본 면과 측면을 분리해 실제 장치의 깊이를 표현한다.
 */
function drawThreeDimensionalPedestal(
  context: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  chamberRadius: number,
  height: number,
): void {
  const neckTopY = baseY - chamberRadius * 0.018;
  const plinthTopY = height - 32;
  const plinthDepth = Math.max(17, chamberRadius * 0.1);

  const neckGradient = context.createLinearGradient(
    centerX - chamberRadius * 0.25,
    neckTopY,
    centerX + chamberRadius * 0.25,
    neckTopY,
  );
  neckGradient.addColorStop(0, "#10192d");
  neckGradient.addColorStop(0.24, "#263552");
  neckGradient.addColorStop(0.48, "#4a5d7d");
  neckGradient.addColorStop(0.7, "#283751");
  neckGradient.addColorStop(1, "#0d1528");

  context.save();
  context.shadowColor = "rgb(16 24 40 / 28%)";
  context.shadowBlur = chamberRadius * 0.055;
  context.shadowOffsetY = chamberRadius * 0.035;
  context.beginPath();
  context.moveTo(centerX - chamberRadius * 0.225, neckTopY);
  context.bezierCurveTo(
    centerX - chamberRadius * 0.205,
    neckTopY + chamberRadius * 0.15,
    centerX - chamberRadius * 0.19,
    plinthTopY - chamberRadius * 0.08,
    centerX - chamberRadius * 0.235,
    plinthTopY,
  );
  context.lineTo(centerX + chamberRadius * 0.235, plinthTopY);
  context.bezierCurveTo(
    centerX + chamberRadius * 0.19,
    plinthTopY - chamberRadius * 0.08,
    centerX + chamberRadius * 0.205,
    neckTopY + chamberRadius * 0.15,
    centerX + chamberRadius * 0.225,
    neckTopY,
  );
  context.closePath();
  context.fillStyle = neckGradient;
  context.fill();
  context.restore();

  const collarGradient = context.createLinearGradient(
    centerX,
    neckTopY - chamberRadius * 0.07,
    centerX,
    neckTopY + chamberRadius * 0.07,
  );
  collarGradient.addColorStop(0, "#7587a4");
  collarGradient.addColorStop(0.28, "#344661");
  collarGradient.addColorStop(0.7, "#17243b");
  collarGradient.addColorStop(1, "#0c1528");

  context.beginPath();
  context.ellipse(
    centerX,
    neckTopY,
    chamberRadius * 0.27,
    chamberRadius * 0.075,
    0,
    0,
    Math.PI * 2,
  );
  context.fillStyle = collarGradient;
  context.fill();

  const contactShadow = context.createRadialGradient(
    centerX + chamberRadius * 0.025,
    neckTopY - chamberRadius * 0.012,
    0,
    centerX + chamberRadius * 0.025,
    neckTopY - chamberRadius * 0.012,
    chamberRadius * 0.24,
  );
  contactShadow.addColorStop(0, "rgb(7 14 28 / 28%)");
  contactShadow.addColorStop(0.52, "rgb(13 24 42 / 13%)");
  contactShadow.addColorStop(1, "rgb(20 37 59 / 0%)");

  context.save();
  context.beginPath();
  context.ellipse(
    centerX,
    neckTopY - chamberRadius * 0.012,
    chamberRadius * 0.245,
    chamberRadius * 0.04,
    0,
    0,
    Math.PI * 2,
  );
  context.clip();
  context.fillStyle = contactShadow;
  context.fillRect(
    centerX - chamberRadius * 0.25,
    neckTopY - chamberRadius * 0.07,
    chamberRadius * 0.5,
    chamberRadius * 0.14,
  );
  context.restore();

  context.beginPath();
  context.ellipse(
    centerX - chamberRadius * 0.035,
    neckTopY - chamberRadius * 0.018,
    chamberRadius * 0.19,
    chamberRadius * 0.035,
    0,
    Math.PI,
    Math.PI * 2,
  );
  context.lineWidth = Math.max(1.5, chamberRadius * 0.009);
  context.strokeStyle = "rgb(222 240 248 / 48%)";
  context.stroke();

  const plinthShadowY = plinthTopY + plinthDepth;
  context.save();
  context.fillStyle = "rgb(25 35 52 / 18%)";
  context.shadowColor = "rgb(20 30 50 / 30%)";
  context.shadowBlur = chamberRadius * 0.07;
  context.beginPath();
  context.ellipse(
    centerX,
    plinthShadowY + chamberRadius * 0.025,
    chamberRadius * 0.5,
    chamberRadius * 0.055,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  const plinthSideGradient = context.createLinearGradient(
    centerX,
    plinthTopY,
    centerX,
    plinthShadowY,
  );
  plinthSideGradient.addColorStop(0, "#fa605f");
  plinthSideGradient.addColorStop(0.42, "#e5484e");
  plinthSideGradient.addColorStop(1, "#b92838");

  context.beginPath();
  context.moveTo(centerX - chamberRadius * 0.45, plinthTopY);
  context.lineTo(centerX - chamberRadius * 0.43, plinthShadowY);
  context.bezierCurveTo(
    centerX - chamberRadius * 0.22,
    plinthShadowY + chamberRadius * 0.045,
    centerX + chamberRadius * 0.22,
    plinthShadowY + chamberRadius * 0.045,
    centerX + chamberRadius * 0.43,
    plinthShadowY,
  );
  context.lineTo(centerX + chamberRadius * 0.45, plinthTopY);
  context.closePath();
  context.fillStyle = plinthSideGradient;
  context.fill();

  const plinthTopGradient = context.createLinearGradient(
    centerX - chamberRadius * 0.45,
    plinthTopY,
    centerX + chamberRadius * 0.45,
    plinthTopY,
  );
  plinthTopGradient.addColorStop(0, "#ff7774");
  plinthTopGradient.addColorStop(0.42, "#ffaaa3");
  plinthTopGradient.addColorStop(0.68, "#ff6262");
  plinthTopGradient.addColorStop(1, "#d73b45");

  context.beginPath();
  context.ellipse(
    centerX,
    plinthTopY,
    chamberRadius * 0.45,
    chamberRadius * 0.065,
    0,
    0,
    Math.PI * 2,
  );
  context.fillStyle = plinthTopGradient;
  context.fill();

  context.beginPath();
  context.ellipse(
    centerX - chamberRadius * 0.08,
    plinthTopY - chamberRadius * 0.012,
    chamberRadius * 0.26,
    chamberRadius * 0.026,
    -0.03,
    Math.PI * 1.04,
    Math.PI * 1.9,
  );
  context.lineCap = "round";
  context.lineWidth = Math.max(1.5, chamberRadius * 0.009);
  context.strokeStyle = "rgb(255 255 255 / 54%)";
  context.stroke();
}

function drawMachineBase(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  isThreeDimensional: boolean,
): void {
  const centerX = width / 2;
  const centerY = height * 0.43;
  const chamberRadius = Math.min(width * 0.4, height * 0.36);
  const baseY = centerY + chamberRadius;

  context.clearRect(0, 0, width, height);

  if (isThreeDimensional) {
    drawGlassChamberBackground(
      context,
      centerX,
      centerY,
      chamberRadius,
    );
    drawThreeDimensionalPedestal(
      context,
      centerX,
      baseY,
      chamberRadius,
      height,
    );
  } else {
    const chamberGradient = context.createRadialGradient(
      centerX - chamberRadius * 0.35,
      centerY - chamberRadius * 0.45,
      chamberRadius * 0.1,
      centerX,
      centerY,
      chamberRadius,
    );
    chamberGradient.addColorStop(0, "rgb(255 255 255 / 92%)");
    chamberGradient.addColorStop(0.72, "rgb(231 240 255 / 58%)");
    chamberGradient.addColorStop(1, "rgb(194 210 242 / 48%)");

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, chamberRadius, 0, Math.PI * 2);
    context.fillStyle = chamberGradient;
    context.fill();
    context.restore();

    context.fillStyle = "#2a3755";
    context.beginPath();
    context.roundRect(
      centerX - chamberRadius * 0.24,
      baseY - 5,
      chamberRadius * 0.48,
      height * 0.16,
      14,
    );
    context.fill();
    context.fillStyle = "#ff5c59";
    context.beginPath();
    context.roundRect(
      centerX - chamberRadius * 0.42,
      height - 30,
      chamberRadius * 0.84,
      20,
      10,
    );
    context.fill();
  }
}

function drawMachineForeground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  isMixing: boolean,
  isThreeDimensional: boolean,
  visualBall: Ball | null,
  ejectionStartedAt: number | null,
): void {
  const centerX = width / 2;
  const centerY = height * 0.43;
  const chamberRadius = Math.min(width * 0.4, height * 0.36);

  if (isThreeDimensional) {
    drawGlassChamberForeground(
      context,
      centerX,
      centerY,
      chamberRadius,
    );
  } else {
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, chamberRadius, 0, Math.PI * 2);
    context.lineWidth = Math.max(6, chamberRadius * 0.035);
    context.strokeStyle = "#2a3755";
    context.stroke();

    context.beginPath();
    context.arc(
      centerX - chamberRadius * 0.2,
      centerY - chamberRadius * 0.25,
      chamberRadius * 0.62,
      Math.PI * 1.02,
      Math.PI * 1.48,
    );
    context.lineWidth = Math.max(3, chamberRadius * 0.018);
    context.strokeStyle = "rgb(255 255 255 / 80%)";
    context.stroke();

    if (isMixing) {
      const rotation = now / 720;

      context.beginPath();
      context.arc(
        centerX,
        centerY,
        chamberRadius * 0.79,
        rotation,
        rotation + Math.PI * 0.22,
      );
      context.lineWidth = Math.max(1.5, chamberRadius * 0.01);
      context.strokeStyle = "rgb(109 151 226 / 24%)";
      context.stroke();

      context.beginPath();
      context.arc(
        centerX,
        centerY,
        chamberRadius * 0.68,
        -rotation * 1.18 + Math.PI,
        -rotation * 1.18 + Math.PI * 1.24,
      );
      context.strokeStyle = "rgb(255 255 255 / 34%)";
      context.stroke();
    }
    context.restore();
  }

  if (visualBall && ejectionStartedAt !== null) {
    const progress = Math.min(1, (now - ejectionStartedAt) / 900);
    const eased = 1 - (1 - progress) ** 3;
    const startY = centerY + chamberRadius * 0.6;
    const endY = height - 42;

    drawBall(
      context,
      visualBall,
      centerX,
      startY + (endY - startY) * eased,
      Math.max(22, chamberRadius * 0.13),
      progress < 0.92 ? 1 : (1 - progress) / 0.08,
    );
  }
}

/**
 * 공통 3축 운동 상태를 유지하면서 Canvas 2D 또는 WebGL 3D로 시각화한다.
 * 렌더링 모드와 프레임 오류는 추첨 세션·난수 결과에 영향을 주지 않는다.
 */
export function LotteryMachine({
  balls,
  renderMode,
  isMixing,
  isSettling,
  visualBall,
  onError,
}: LotteryMachineProps) {
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const background3dRef = useRef<HTMLCanvasElement>(null);
  const webglRef = useRef<HTMLCanvasElement>(null);
  const overlay3dRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Map<string, BallMotionNode>>(new Map());
  const ejectionRef = useRef<{
    ballId: string | null;
    startedAt: number | null;
  }>({ ballId: null, startedAt: null });

  useEffect(() => {
    const container = containerRef.current;
    const canvas2d = canvas2dRef.current;
    const background3d = background3dRef.current;
    const webglCanvas = webglRef.current;
    const overlay3d = overlay3dRef.current;

    if (!container) {
      return undefined;
    }

    const context2d =
      renderMode === "2d" ? canvas2d?.getContext("2d") ?? null : null;
    const backgroundContext =
      renderMode === "3d"
        ? background3d?.getContext("2d") ?? null
        : null;
    const overlayContext =
      renderMode === "3d" ? overlay3d?.getContext("2d") ?? null : null;

    if (
      (renderMode === "2d" && (!canvas2d || !context2d)) ||
      (renderMode === "3d" &&
        (!background3d ||
          !webglCanvas ||
          !overlay3d ||
          !backgroundContext ||
          !overlayContext))
    ) {
      onError(CANVAS_ERROR);
      return undefined;
    }

    let renderer3d: Lottery3dRenderer | null = null;

    if (renderMode === "3d" && webglCanvas) {
      try {
        renderer3d = new Lottery3dRenderer(webglCanvas);
        renderer3d.syncBalls(balls);
      } catch {
        renderer3d?.dispose();
        renderer3d = null;
        onError(WEBGL_ERROR);
      }
    }

    const handleWebglContextLost = (event: Event) => {
      event.preventDefault();
      renderer3d?.dispose();
      renderer3d = null;
      onError(WEBGL_ERROR);
    };

    webglCanvas?.addEventListener(
      "webglcontextlost",
      handleWebglContextLost,
    );

    let frame = 0;
    let width = 0;
    let height = 0;
    let previousTime = performance.now();
    const nodes = nodesRef.current;
    const ejection = ejectionRef.current;

    if (visualBall && visualBall.id !== ejection.ballId) {
      ejection.ballId = visualBall.id;
      ejection.startedAt = performance.now();
    } else if (!visualBall) {
      ejection.ballId = null;
      ejection.startedAt = null;
    }

    const resize2dCanvas = (
      canvas: HTMLCanvasElement,
      context: CanvasRenderingContext2D,
      pixelRatio: number,
    ) => {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const resize = () => {
      const rectangle = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(280, rectangle.width || 640);
      const nextHeight = Math.max(360, rectangle.height || nextWidth * 0.82);

      if (width > 0 && height > 0) {
        const previousRadius = Math.min(width * 0.4, height * 0.36);
        const nextRadius = Math.min(nextWidth * 0.4, nextHeight * 0.36);
        const scale = nextRadius / previousRadius;

        for (const node of nodes.values()) {
          scaleBallMotionNode(node, scale);
        }
      }

      width = nextWidth;
      height = nextHeight;

      if (canvas2d && context2d) {
        resize2dCanvas(canvas2d, context2d, pixelRatio);
      }

      if (
        background3d &&
        backgroundContext &&
        overlay3d &&
        overlayContext
      ) {
        resize2dCanvas(background3d, backgroundContext, pixelRatio);
        resize2dCanvas(overlay3d, overlayContext, pixelRatio);
        renderer3d?.resize(width, height, pixelRatio);
      }
    };

    const syncNodes = () => {
      const activeIds = new Set(balls.map((ball) => ball.id));

      for (const id of nodes.keys()) {
        if (!activeIds.has(id)) {
          nodes.delete(id);
        }
      }

      balls.forEach((ball, index) => {
        const existingNode = nodes.get(ball.id);

        if (existingNode && Number.isFinite(existingNode.z)) {
          return;
        }

        const chamberRadius = Math.min(width * 0.4, height * 0.36);
        nodes.set(
          ball.id,
          createBallMotionNode(ball.id, index, balls.length, chamberRadius),
        );
      });
    };

    const animate = (now: number) => {
      try {
        const delta = Math.min(0.034, (now - previousTime) / 1_000);
        previousTime = now;
        syncNodes();

        const centerX = width / 2;
        const centerY = height * 0.43;
        const chamberRadius = Math.min(width * 0.4, height * 0.36);
        const ballRadius = Math.max(
          9,
          Math.min(
            31,
            chamberRadius / (Math.sqrt(Math.max(balls.length, 5)) * 1.75),
          ),
        );
        const nodeList = [...nodes.values()];

        if (isSettling) {
          advanceSettlingBallMotionNodes(
            nodeList,
            delta,
            chamberRadius,
            ballRadius,
          );
        } else {
          nodeList.forEach((node, index) => {
            advanceBallMotionNode(
              node,
              index,
              now,
              delta,
              isMixing,
              chamberRadius,
              ballRadius,
            );
          });
        }

        const project =
          renderMode === "3d"
            ? projectBallMotionNode3d
            : projectBallMotionNode;
        const projectedNodes = nodeList
          .map((node) => ({
            node,
            projected: project(
              node,
              centerX,
              centerY,
              chamberRadius,
              ballRadius,
            ),
          }))
          .sort(
            (first, second) =>
              first.projected.depth - second.projected.depth,
          );
        const ballsById = new Map(balls.map((ball) => [ball.id, ball]));

        if (renderMode === "2d" && context2d) {
          drawMachineBase(context2d, width, height, false);
          projectedNodes.forEach(({ node, projected }) => {
            const ball = ballsById.get(node.id);

            if (ball) {
              if (isMixing) {
                drawMotionTrail(context2d, ball, node, projected);
              }

              drawBall(
                context2d,
                ball,
                projected.x,
                projected.y,
                projected.radius,
                projected.opacity,
              );
            }
          });
          drawMachineForeground(
            context2d,
            width,
            height,
            now,
            isMixing,
            false,
            visualBall,
            ejection.startedAt,
          );
        } else if (
          renderMode === "3d" &&
          backgroundContext &&
          overlayContext
        ) {
          drawMachineBase(backgroundContext, width, height, true);
          overlayContext.clearRect(0, 0, width, height);
          const frameBalls = projectedNodes.flatMap<Lottery3dFrameBall>(
            ({ node, projected }) => {
              const ball = ballsById.get(node.id);
              return ball ? [{ ball, projected }] : [];
            },
          );

          if (renderer3d) {
            try {
              renderer3d.render(frameBalls);
            } catch {
              renderer3d.dispose();
              renderer3d = null;
              onError(WEBGL_ERROR);
            }
          }

          if (!renderer3d) {
            frameBalls.forEach(({ ball, projected }) => {
              drawBall(
                overlayContext,
                ball,
                projected.x,
                projected.y,
                projected.radius,
                projected.opacity,
              );
            });
          }

          drawMachineForeground(
            overlayContext,
            width,
            height,
            now,
            isMixing,
            true,
            visualBall,
            ejection.startedAt,
          );
        }

        frame = window.requestAnimationFrame(animate);
      } catch {
        onError(CANVAS_ERROR);
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    frame = window.requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      webglCanvas?.removeEventListener(
        "webglcontextlost",
        handleWebglContextLost,
      );
      renderer3d?.dispose();
    };
  }, [
    balls,
    isMixing,
    isSettling,
    onError,
    renderMode,
    visualBall,
  ]);

  const ariaLabel = `남은 공 ${balls.length}개가 들어 있는 로또 추첨기`;

  return (
    <div
      className={
        renderMode === "3d"
          ? "machine-frame machine-frame--3d"
          : "machine-frame"
      }
      ref={containerRef}
    >
      {renderMode === "2d" ? (
        <canvas
          ref={canvas2dRef}
          className="lottery-canvas lottery-canvas--2d"
          aria-label={ariaLabel}
        />
      ) : (
        <>
          <canvas
            ref={background3dRef}
            className="lottery-canvas lottery-canvas-layer lottery-canvas--background"
            aria-hidden="true"
          />
          <canvas
            ref={webglRef}
            className="lottery-canvas lottery-canvas-layer lottery-canvas--3d"
            aria-label={ariaLabel}
          />
          <canvas
            ref={overlay3dRef}
            className="lottery-canvas lottery-canvas-layer lottery-canvas--overlay"
            aria-hidden="true"
          />
        </>
      )}
      <div className="machine-badge">
        <span>남은 공</span>
        <strong>{balls.length}</strong>
      </div>
    </div>
  );
}
