import type { Ball } from "../domain/types";
import type { ProjectedBallNode } from "./lotteryMotion";

const ATLAS_SIZE = 1_024;
const ATLAS_COLUMNS = 8;
const ATLAS_CELL_SIZE = 128;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  attribute float a_opacity;
  varying vec2 v_uv;
  varying float v_opacity;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_uv;
    v_opacity = a_opacity;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_texture;
  varying vec2 v_uv;
  varying float v_opacity;

  void main() {
    vec4 color = texture2D(u_texture, v_uv);
    gl_FragColor = vec4(color.rgb, color.a * v_opacity);
  }
`;

export type Lottery3dFrameBall = {
  ball: Ball;
  projected: ProjectedBallNode;
};

type TextureCoordinates = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

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

function drawBallTexture(
  context: CanvasRenderingContext2D,
  ball: Ball,
  centerX: number,
  centerY: number,
): void {
  const radius = ATLAS_CELL_SIZE * 0.44;
  const gradient = context.createRadialGradient(
    centerX - radius * 0.38,
    centerY - radius * 0.46,
    radius * 0.04,
    centerX,
    centerY,
    radius,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.15, ball.color);
  gradient.addColorStop(0.72, ball.color);
  gradient.addColorStop(1, "#243453");

  context.save();
  context.shadowColor = "rgb(15 23 42 / 42%)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 7;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 3;
  context.strokeStyle = "rgb(255 255 255 / 72%)";
  context.stroke();

  context.beginPath();
  context.ellipse(
    centerX - radius * 0.28,
    centerY - radius * 0.34,
    radius * 0.2,
    radius * 0.11,
    -0.55,
    0,
    Math.PI * 2,
  );
  context.fillStyle = "rgb(255 255 255 / 58%)";
  context.fill();

  context.fillStyle = "#172033";
  context.font = "800 22px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    displayName(context, ball.name, radius * 1.42),
    centerX,
    centerY + 2,
  );
  context.restore();
}

function createTextureAtlas(balls: Ball[]): {
  canvas: HTMLCanvasElement;
  coordinates: Map<string, TextureCoordinates>;
} {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("3D 공 텍스처를 생성할 수 없습니다.");
  }

  const coordinates = new Map<string, TextureCoordinates>();

  balls.forEach((ball, index) => {
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    const left = column * ATLAS_CELL_SIZE;
    const top = row * ATLAS_CELL_SIZE;

    drawBallTexture(
      context,
      ball,
      left + ATLAS_CELL_SIZE / 2,
      top + ATLAS_CELL_SIZE / 2,
    );
    coordinates.set(ball.id, {
      left: left / ATLAS_SIZE,
      top: top / ATLAS_SIZE,
      right: (left + ATLAS_CELL_SIZE) / ATLAS_SIZE,
      bottom: (top + ATLAS_CELL_SIZE) / ATLAS_SIZE,
    });
  });

  return { canvas, coordinates };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("WebGL 셰이더를 생성할 수 없습니다.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "알 수 없는 셰이더 오류";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER,
  );
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("WebGL 프로그램을 생성할 수 없습니다.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "알 수 없는 연결 오류";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

/**
 * 공 이름이 포함된 Canvas 텍스처를 WebGL 빌보드로 그린다.
 * 추첨 물리와 결과에는 관여하지 않고 프레임별 투영 결과만 소비한다.
 */
export class Lottery3dRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly positionLocation: number;
  private readonly textureLocation: number;
  private readonly opacityLocation: number;
  private textureCoordinates = new Map<string, TextureCoordinates>();
  private ballsSignature = "";
  private width = 1;
  private height = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    }) as WebGLRenderingContext | null;

    if (!gl || typeof gl.createShader !== "function") {
      throw new Error("WebGL을 사용할 수 없습니다.");
    }

    const program = createProgram(gl);
    const vertexBuffer = gl.createBuffer();
    const texture = gl.createTexture();

    if (!vertexBuffer || !texture) {
      gl.deleteProgram(program);
      throw new Error("WebGL 리소스를 생성할 수 없습니다.");
    }

    this.gl = gl;
    this.program = program;
    this.vertexBuffer = vertexBuffer;
    this.texture = texture;
    this.positionLocation = gl.getAttribLocation(program, "a_position");
    this.textureLocation = gl.getAttribLocation(program, "a_uv");
    this.opacityLocation = gl.getAttribLocation(program, "a_opacity");

    if (
      this.positionLocation < 0 ||
      this.textureLocation < 0 ||
      this.opacityLocation < 0
    ) {
      this.dispose();
      throw new Error("WebGL 속성을 찾을 수 없습니다.");
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.enableVertexAttribArray(this.textureLocation);
    gl.enableVertexAttribArray(this.opacityLocation);
    gl.vertexAttribPointer(
      this.positionLocation,
      2,
      gl.FLOAT,
      false,
      20,
      0,
    );
    gl.vertexAttribPointer(
      this.textureLocation,
      2,
      gl.FLOAT,
      false,
      20,
      8,
    );
    gl.vertexAttribPointer(
      this.opacityLocation,
      1,
      gl.FLOAT,
      false,
      20,
      16,
    );
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  syncBalls(balls: Ball[]): void {
    const signature = balls
      .map((ball) => `${ball.id}:${ball.name}:${ball.color}`)
      .join("|");

    if (signature === this.ballsSignature) {
      return;
    }

    const atlas = createTextureAtlas(balls);
    this.textureCoordinates = atlas.coordinates;
    this.ballsSignature = signature;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      atlas.canvas,
    );
  }

  render(frameBalls: Lottery3dFrameBall[]): void {
    const gl = this.gl;
    const vertices: number[] = [];
    const orderedBalls = [...frameBalls].sort(
      (first, second) =>
        first.projected.depth - second.projected.depth,
    );

    const pushVertex = (
      x: number,
      y: number,
      u: number,
      v: number,
      opacity: number,
    ) => {
      vertices.push(
        (x / this.width) * 2 - 1,
        1 - (y / this.height) * 2,
        u,
        v,
        opacity,
      );
    };

    orderedBalls.forEach(({ ball, projected }) => {
      const coordinates = this.textureCoordinates.get(ball.id);

      if (!coordinates) {
        return;
      }

      const left = projected.x - projected.radius;
      const right = projected.x + projected.radius;
      const top = projected.y - projected.radius;
      const bottom = projected.y + projected.radius;
      const opacity = projected.opacity;

      pushVertex(
        left,
        top,
        coordinates.left,
        coordinates.top,
        opacity,
      );
      pushVertex(
        left,
        bottom,
        coordinates.left,
        coordinates.bottom,
        opacity,
      );
      pushVertex(
        right,
        bottom,
        coordinates.right,
        coordinates.bottom,
        opacity,
      );
      pushVertex(
        left,
        top,
        coordinates.left,
        coordinates.top,
        opacity,
      );
      pushVertex(
        right,
        bottom,
        coordinates.right,
        coordinates.bottom,
        opacity,
      );
      pushVertex(
        right,
        top,
        coordinates.right,
        coordinates.top,
        opacity,
      );
    });

    gl.clear(gl.COLOR_BUFFER_BIT);

    if (vertices.length === 0) {
      return;
    }

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      gl.DYNAMIC_DRAW,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
  }

  dispose(): void {
    this.gl?.deleteBuffer(this.vertexBuffer);
    this.gl?.deleteTexture(this.texture);
    this.gl?.deleteProgram(this.program);
  }
}
