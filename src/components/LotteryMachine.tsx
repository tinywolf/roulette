import { useEffect, useRef } from "react";
import type { Ball } from "../domain/types";

type LotteryMachineProps = {
  balls: Ball[];
  isMixing: boolean;
  visualBall: Ball | null;
  onError: (message: string) => void;
};

type BallNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
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

export function LotteryMachine({
  balls,
  isMixing,
  visualBall,
  onError,
}: LotteryMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Map<string, BallNode>>(new Map());

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
    const ejectionStartedAt = visualBall ? performance.now() : null;
    const nodes = nodesRef.current;

    const resize = () => {
      const rectangle = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(280, rectangle.width || 640);
      const nextHeight = Math.max(360, rectangle.height || nextWidth * 0.82);

      if (width > 0 && height > 0) {
        const previousCenterX = width / 2;
        const previousCenterY = height * 0.43;
        const previousRadius = Math.min(width * 0.4, height * 0.36);
        const nextCenterX = nextWidth / 2;
        const nextCenterY = nextHeight * 0.43;
        const nextRadius = Math.min(nextWidth * 0.4, nextHeight * 0.36);
        const scale = nextRadius / previousRadius;

        for (const node of nodes.values()) {
          node.x = nextCenterX + (node.x - previousCenterX) * scale;
          node.y = nextCenterY + (node.y - previousCenterY) * scale;
          node.vx *= scale;
          node.vy *= scale;
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
        if (nodes.has(ball.id)) {
          return;
        }

        const angle = index * 2.399963 + 0.4;
        const chamberRadius = Math.min(width * 0.4, height * 0.36);
        const distance =
          chamberRadius *
          0.72 *
          Math.sqrt((index + 0.5) / Math.max(balls.length, 1));
        nodes.set(ball.id, {
          id: ball.id,
          x: width / 2 + Math.cos(angle) * distance,
          y: height * 0.45 + Math.sin(angle) * distance,
          vx: Math.cos(angle + 1.1) * 72,
          vy: Math.sin(angle + 1.1) * 72,
        });
      });
    };

    const drawMachine = (now: number) => {
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
          const movement = isMixing ? 44 : 8;
          node.vx += Math.sin(now / 380 + index * 1.71) * movement * delta;
          node.vy += Math.cos(now / 330 + index * 1.37) * movement * delta;

          const speed = Math.hypot(node.vx, node.vy);
          const maximumSpeed = isMixing ? 190 : 58;

          if (speed > maximumSpeed) {
            node.vx = (node.vx / speed) * maximumSpeed;
            node.vy = (node.vy / speed) * maximumSpeed;
          }

          if (!isMixing) {
            node.vx *= 0.985;
            node.vy *= 0.985;
          }

          node.x += node.vx * delta;
          node.y += node.vy * delta;

          const offsetX = node.x - centerX;
          const offsetY = node.y - centerY;
          const distance = Math.hypot(offsetX, offsetY);
          const boundary = chamberRadius - ballRadius - 6;

          if (distance > boundary) {
            const normalX = offsetX / distance;
            const normalY = offsetY / distance;
            node.x = centerX + normalX * boundary;
            node.y = centerY + normalY * boundary;
            const dot = node.vx * normalX + node.vy * normalY;
            node.vx -= 1.82 * dot * normalX;
            node.vy -= 1.82 * dot * normalY;
          }
        });

        for (let firstIndex = 0; firstIndex < nodeList.length; firstIndex += 1) {
          for (
            let secondIndex = firstIndex + 1;
            secondIndex < nodeList.length;
            secondIndex += 1
          ) {
            const first = nodeList[firstIndex];
            const second = nodeList[secondIndex];
            const offsetX = second.x - first.x;
            const offsetY = second.y - first.y;
            const distance = Math.max(0.001, Math.hypot(offsetX, offsetY));
            const minimumDistance = ballRadius * 2.04;

            if (distance >= minimumDistance) {
              continue;
            }

            const normalX = offsetX / distance;
            const normalY = offsetY / distance;
            const overlap = (minimumDistance - distance) / 2;
            first.x -= normalX * overlap;
            first.y -= normalY * overlap;
            second.x += normalX * overlap;
            second.y += normalY * overlap;
            const relativeVelocity =
              (second.vx - first.vx) * normalX +
              (second.vy - first.vy) * normalY;

            if (relativeVelocity < 0) {
              first.vx += relativeVelocity * normalX;
              first.vy += relativeVelocity * normalY;
              second.vx -= relativeVelocity * normalX;
              second.vy -= relativeVelocity * normalY;
            }
          }
        }

        drawMachine(now);
        nodeList.forEach((node) => {
          const ball = balls.find((candidate) => candidate.id === node.id);

          if (ball) {
            drawBall(context, ball, node.x, node.y, ballRadius);
          }
        });

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
