import type { Ball } from "../domain/types";
import type { ProjectedBallNode } from "./lotteryMotion";

const ATLAS_SIZE = 1_024;
const ATLAS_COLUMNS = 8;
const ATLAS_CELL_SIZE = 128;
const VERTEX_FLOAT_COUNT = 6;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  attribute float a_opacity;
  attribute float a_texture_kind;
  varying vec2 v_uv;
  varying float v_opacity;
  varying float v_texture_kind;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_uv;
    v_opacity = a_opacity;
    v_texture_kind = a_texture_kind;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_ball_texture;
  uniform sampler2D u_scene_texture;
  varying vec2 v_uv;
  varying float v_opacity;
  varying float v_texture_kind;

  void main() {
    vec4 color = v_texture_kind < 0.5
      ? texture2D(u_ball_texture, v_uv)
      : texture2D(u_scene_texture, v_uv);
    gl_FragColor = vec4(
      color.rgb * v_opacity,
      color.a * v_opacity
    );
  }
`;

export type Lottery3dFrameBall = {
  ball: Ball;
  projected: ProjectedBallNode;
};

export type Lottery3dEjectedBall = {
  ball: Ball;
  x: number;
  y: number;
  radius: number;
  opacity: number;
};

export type Lottery3dSceneLayer = "background" | "foreground";

export type Lottery3dScenePainter = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: Lottery3dSceneLayer,
) => void;

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

function configureTexture(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  textureUnit: number,
): void {
  gl.activeTexture(textureUnit);
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
}

/**
 * 유리구·공·받침을 단일 WebGL Canvas에서 한 번의 draw call로 합성한다.
 * 정적 장면은 리사이즈 때만 Canvas 텍스처로 갱신하고 매 프레임에는 공 버퍼만 바꾼다.
 */
export class Lottery3dRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly ballTexture: WebGLTexture;
  private readonly sceneTexture: WebGLTexture;
  private readonly maximumTextureSize: number;
  private textureCoordinates = new Map<string, TextureCoordinates>();
  private ballsSignature = "";
  private sceneSignature = "";
  private sceneReady = false;
  private width = 1;
  private height = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;

    if (!gl || typeof gl.createShader !== "function") {
      throw new Error("WebGL을 사용할 수 없습니다.");
    }

    const program = createProgram(gl);
    const vertexBuffer = gl.createBuffer();
    const ballTexture = gl.createTexture();
    const sceneTexture = gl.createTexture();

    if (!vertexBuffer || !ballTexture || !sceneTexture) {
      gl.deleteBuffer(vertexBuffer);
      gl.deleteTexture(ballTexture);
      gl.deleteTexture(sceneTexture);
      gl.deleteProgram(program);
      throw new Error("WebGL 리소스를 생성할 수 없습니다.");
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const textureLocation = gl.getAttribLocation(program, "a_uv");
    const opacityLocation = gl.getAttribLocation(program, "a_opacity");
    const textureKindLocation = gl.getAttribLocation(
      program,
      "a_texture_kind",
    );

    if (
      positionLocation < 0 ||
      textureLocation < 0 ||
      opacityLocation < 0 ||
      textureKindLocation < 0
    ) {
      gl.deleteBuffer(vertexBuffer);
      gl.deleteTexture(ballTexture);
      gl.deleteTexture(sceneTexture);
      gl.deleteProgram(program);
      throw new Error("WebGL 속성을 찾을 수 없습니다.");
    }

    this.gl = gl;
    this.program = program;
    this.vertexBuffer = vertexBuffer;
    this.ballTexture = ballTexture;
    this.sceneTexture = sceneTexture;
    this.maximumTextureSize = gl.getParameter(
      gl.MAX_TEXTURE_SIZE,
    ) as number;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.enableVertexAttribArray(textureLocation);
    gl.enableVertexAttribArray(opacityLocation);
    gl.enableVertexAttribArray(textureKindLocation);
    gl.vertexAttribPointer(
      positionLocation,
      2,
      gl.FLOAT,
      false,
      VERTEX_FLOAT_COUNT * 4,
      0,
    );
    gl.vertexAttribPointer(
      textureLocation,
      2,
      gl.FLOAT,
      false,
      VERTEX_FLOAT_COUNT * 4,
      8,
    );
    gl.vertexAttribPointer(
      opacityLocation,
      1,
      gl.FLOAT,
      false,
      VERTEX_FLOAT_COUNT * 4,
      16,
    );
    gl.vertexAttribPointer(
      textureKindLocation,
      1,
      gl.FLOAT,
      false,
      VERTEX_FLOAT_COUNT * 4,
      20,
    );

    configureTexture(gl, ballTexture, gl.TEXTURE0);
    configureTexture(gl, sceneTexture, gl.TEXTURE1);
    gl.uniform1i(
      gl.getUniformLocation(program, "u_ball_texture"),
      0,
    );
    gl.uniform1i(
      gl.getUniformLocation(program, "u_scene_texture"),
      1,
    );
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(
    width: number,
    height: number,
    pixelRatio: number,
    paintScene: Lottery3dScenePainter,
  ): void {
    const requestedRatio = Math.min(pixelRatio, 2);
    const sceneRatio = Math.max(
      0.5,
      Math.min(
        requestedRatio,
        this.maximumTextureSize / width,
        this.maximumTextureSize / (height * 2),
      ),
    );
    const signature = [
      width,
      height,
      requestedRatio,
      sceneRatio,
    ].join(":");

    this.width = width;
    this.height = height;

    if (signature === this.sceneSignature) {
      return;
    }

    this.canvas.width = Math.round(width * requestedRatio);
    this.canvas.height = Math.round(height * requestedRatio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const sceneCanvas = document.createElement("canvas");
    const sceneWidth = Math.max(1, Math.round(width * sceneRatio));
    const sceneLayerHeight = Math.max(
      1,
      Math.round(height * sceneRatio),
    );
    sceneCanvas.width = sceneWidth;
    sceneCanvas.height = sceneLayerHeight * 2;
    const context = sceneCanvas.getContext("2d");

    if (!context) {
      throw new Error("3D 장면 텍스처를 생성할 수 없습니다.");
    }

    context.setTransform(
      sceneWidth / width,
      0,
      0,
      sceneLayerHeight / height,
      0,
      0,
    );
    paintScene(context, width, height, "background");
    context.setTransform(
      sceneWidth / width,
      0,
      0,
      sceneLayerHeight / height,
      0,
      sceneLayerHeight,
    );
    paintScene(context, width, height, "foreground");

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sceneCanvas,
    );
    this.sceneSignature = signature;
    this.sceneReady = true;
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
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.ballTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      atlas.canvas,
    );
  }

  render(
    frameBalls: Lottery3dFrameBall[],
    ejectedBall: Lottery3dEjectedBall | null,
  ): void {
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
      textureKind: number,
    ) => {
      vertices.push(
        (x / this.width) * 2 - 1,
        1 - (y / this.height) * 2,
        u,
        v,
        opacity,
        textureKind,
      );
    };

    const pushQuad = (
      left: number,
      top: number,
      right: number,
      bottom: number,
      texture: TextureCoordinates,
      opacity: number,
      textureKind: number,
    ) => {
      pushVertex(
        left,
        top,
        texture.left,
        texture.top,
        opacity,
        textureKind,
      );
      pushVertex(
        left,
        bottom,
        texture.left,
        texture.bottom,
        opacity,
        textureKind,
      );
      pushVertex(
        right,
        bottom,
        texture.right,
        texture.bottom,
        opacity,
        textureKind,
      );
      pushVertex(
        left,
        top,
        texture.left,
        texture.top,
        opacity,
        textureKind,
      );
      pushVertex(
        right,
        bottom,
        texture.right,
        texture.bottom,
        opacity,
        textureKind,
      );
      pushVertex(
        right,
        top,
        texture.right,
        texture.top,
        opacity,
        textureKind,
      );
    };

    if (this.sceneReady) {
      pushQuad(
        0,
        0,
        this.width,
        this.height,
        { left: 0, top: 0, right: 1, bottom: 0.5 },
        1,
        1,
      );
    }

    const pushBall = (
      ball: Ball,
      x: number,
      y: number,
      radius: number,
      opacity: number,
    ) => {
      const coordinates = this.textureCoordinates.get(ball.id);

      if (!coordinates) {
        return;
      }

      pushQuad(
        x - radius,
        y - radius,
        x + radius,
        y + radius,
        coordinates,
        opacity,
        0,
      );
    };

    orderedBalls.forEach(({ ball, projected }) => {
      pushBall(
        ball,
        projected.x,
        projected.y,
        projected.radius,
        projected.opacity,
      );
    });

    if (this.sceneReady) {
      pushQuad(
        0,
        0,
        this.width,
        this.height,
        { left: 0, top: 0.5, right: 1, bottom: 1 },
        1,
        1,
      );
    }

    if (ejectedBall) {
      pushBall(
        ejectedBall.ball,
        ejectedBall.x,
        ejectedBall.y,
        ejectedBall.radius,
        ejectedBall.opacity,
      );
    }

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
    gl.bindTexture(gl.TEXTURE_2D, this.ballTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.drawArrays(
      gl.TRIANGLES,
      0,
      vertices.length / VERTEX_FLOAT_COUNT,
    );
  }

  dispose(): void {
    this.gl?.deleteBuffer(this.vertexBuffer);
    this.gl?.deleteTexture(this.ballTexture);
    this.gl?.deleteTexture(this.sceneTexture);
    this.gl?.deleteProgram(this.program);
  }
}
