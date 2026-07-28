import { useEffect, useRef } from "react";
import type { Ball } from "../domain/types";
import {
  advanceBallMotionNode,
  createBallMotionNode,
  projectBallMotionNode,
  scaleBallMotionNode,
  type BallMotionNode,
  type ProjectedBallNode,
} from "./lotteryMotion";

type LotteryMachineProps = {
  balls: Ball[];
  isMixing: boolean;
  visualBall: Ball | null;
  onError: (message: string) => void;
};

const CANVAS_ERROR =
  "추첨기 연출을 표시하지 못했습니다. 추첨 결과는 계속 정확하게 처리됩니다.";

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

export function LotteryMachine({
  balls,
  isMixing,
  visualBall,
  onError,
}: LotteryMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Map<string, BallMotionNode>>(new Map());
  const ejectionRef = useRef<{
    ballId: string | null;
    startedAt: number | null;
  }>({ ballId: null, startedAt: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      onError(CANVAS_ERROR);
      return undefined;
    }

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
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
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

    const drawMachineBase = () => {
      const centerX = width / 2;
      const centerY = height * 0.43;
      const chamberRadius = Math.min(width * 0.4, height * 0.36);
      const baseY = centerY + chamberRadius;

      context.clearRect(0, 0, width, height);

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
    };

    const drawMachineForeground = (now: number) => {
      const centerX = width / 2;
      const centerY = height * 0.43;
      const chamberRadius = Math.min(width * 0.4, height * 0.36);

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

      if (visualBall && ejection.startedAt !== null) {
        const progress = Math.min(1, (now - ejection.startedAt) / 900);
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

        const projectedNodes = nodeList
          .map((node) => ({
            node,
            projected: projectBallMotionNode(
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

        drawMachineBase();
        projectedNodes.forEach(({ node, projected }) => {
          const ball = ballsById.get(node.id);

          if (ball) {
            if (isMixing) {
              drawMotionTrail(context, ball, node, projected);
            }

            drawBall(
              context,
              ball,
              projected.x,
              projected.y,
              projected.radius,
              projected.opacity,
            );
          }
        });
        drawMachineForeground(now);

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
    };
  }, [balls, isMixing, onError, visualBall]);

  return (
    <div className="machine-frame" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="lottery-canvas"
        aria-label={`남은 공 ${balls.length}개가 들어 있는 로또 추첨기`}
      />
      <div className="machine-badge">
        <span>남은 공</span>
        <strong>{balls.length}</strong>
      </div>
    </div>
  );
}
