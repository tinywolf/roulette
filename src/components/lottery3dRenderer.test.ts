import { describe, expect, it, vi } from "vitest";
import { Lottery3dRenderer } from "./lottery3dRenderer";

function createWebglMock(): WebGLRenderingContext {
  const gl = {
    ARRAY_BUFFER: 0x8892,
    BLEND: 0x0be2,
    COLOR_BUFFER_BIT: 0x4000,
    COMPILE_STATUS: 0x8b81,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    FRAGMENT_SHADER: 0x8b30,
    LINEAR: 0x2601,
    LINK_STATUS: 0x8b82,
    MAX_TEXTURE_SIZE: 0x0d33,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    RGBA: 0x1908,
    TEXTURE0: 0x84c0,
    TEXTURE1: 0x84c1,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TRIANGLES: 0x0004,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    UNSIGNED_BYTE: 0x1401,
    VERTEX_SHADER: 0x8b31,
    CLAMP_TO_EDGE: 0x812f,
    activeTexture: vi.fn(),
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    bindTexture: vi.fn(),
    blendFunc: vi.fn(),
    bufferData: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    deleteTexture: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3),
    getParameter: vi.fn(() => 4_096),
    getProgramInfoLog: vi.fn(() => ""),
    getProgramParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    getShaderParameter: vi.fn(() => true),
    getUniformLocation: vi.fn(() => ({})),
    linkProgram: vi.fn(),
    pixelStorei: vi.fn(),
    shaderSource: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    uniform1i: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
  };

  return gl as unknown as WebGLRenderingContext;
}

describe("Lottery3dRenderer", () => {
  it("정적 장면을 리사이즈 때만 만들고 한 draw call로 합성한다", () => {
    const gl = createWebglMock();
    const canvas = {
      getContext: vi.fn(() => gl),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement;
    const paintScene = vi.fn();
    const renderer = new Lottery3dRenderer(canvas);

    renderer.resize(640, 500, 2, paintScene);
    renderer.resize(640, 500, 2, paintScene);
    renderer.render([], null);

    expect(paintScene).toHaveBeenCalledTimes(2);
    expect(paintScene.mock.calls.map((call) => call[3])).toEqual([
      "background",
      "foreground",
    ]);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    expect(gl.drawArrays).toHaveBeenCalledWith(
      gl.TRIANGLES,
      0,
      12,
    );

    renderer.resize(390, 500, 2, paintScene);

    expect(canvas.width).toBe(780);
    expect(canvas.height).toBe(1_000);
    expect(paintScene).toHaveBeenCalledTimes(4);
  });
});
