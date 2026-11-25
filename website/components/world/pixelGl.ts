import { joinMask } from "../../lib/world/joins";
import { joinKey, joinView, placements, planOf, sizeCanvas, type JoinDraw, type LoadedScene, type PixelRenderer, type ShotDraw } from "./sceneArt";

const VS = `#version 300 es
uniform vec4 u_rect; // destination x, y, w, h in pixels, y down
uniform vec2 u_dst;
uniform vec4 u_src; // source u0, v0, u1, v1
out vec2 v_uv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 p = u_rect.xy + c * u_rect.zw;
  gl_Position = vec4(p.x / u_dst.x * 2.0 - 1.0, 1.0 - p.y / u_dst.y * 2.0, 0.0, 1.0);
  v_uv = mix(u_src.xy, u_src.zw, c);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_uv;
out vec4 o;
void main() { o = texture(u_tex, v_uv); }`;

// A join: every pixel is A, B or an overlay colour, as the mask (made by joinMask) says; A and B are read with NEAREST.
const JVS = `#version 300 es
void main() { gl_Position = vec4(float(gl_VertexID & 1) * 2.0 - 1.0, float(gl_VertexID >> 1) * 2.0 - 1.0, 0.0, 1.0); }`;
const JFS = `#version 300 es
precision highp float;
uniform sampler2D u_a, u_b, u_mask;
uniform vec2 u_view;
uniform vec4 u_za, u_zb; // source point xy, where it is drawn zw
uniform vec2 u_z; // zoom of A, of B
out vec4 o;
vec3 side(sampler2D t, vec4 zz, float z, vec2 p) {
  vec2 s = floor(zz.xy + (p - zz.zw) / z);
  return texture(t, vec2((s.x + 0.5) / u_view.x, 1.0 - (s.y + 0.5) / u_view.y)).rgb; // a framebuffer texture is upside down
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, u_view.y - gl_FragCoord.y);
  vec4 m = texture(u_mask, p / u_view);
  o = vec4(m.a > 0.75 ? m.rgb : m.a > 0.25 ? side(u_b, u_zb, u_z.y, p) : side(u_a, u_za, u_z.x, p), 1.0);
}`;

type Tex = { tex: WebGLTexture; w: number; h: number };
type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture };

/** Draws shots at art resolution straight onto the canvas, which is the view size; the page scales it up by a whole number. Throws when WebGL2 is missing. */
export function createPixelRenderer(canvas: HTMLCanvasElement): PixelRenderer {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("no WebGL2");

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    return p;
  };
  const prog = program(VS, FS);
  const jprog = program(JVS, JFS);
  const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  gl.useProgram(jprog);
  [["u_a", 0], ["u_b", 1], ["u_mask", 2]].forEach(([n, i]) => gl.uniform1i(u(jprog, n as string), i as number));
  const [jView, jZa, jZb, jZ] = [u(jprog, "u_view"), u(jprog, "u_za"), u(jprog, "u_zb"), u(jprog, "u_z")];
  gl.useProgram(prog);
  const [uRect, uDst, uSrc] = [u(prog, "u_rect"), u(prog, "u_dst"), u(prog, "u_src")];
  gl.uniform1i(u(prog, "u_tex"), 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); // the PNG's palette reaches the screen unchanged

  const setup = (t: WebGLTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const texes = new Map<HTMLImageElement, Tex>();
  const texOf = (img: HTMLImageElement): Tex => {
    let t = texes.get(img);
    if (!t) {
      const tex = gl.createTexture()!;
      setup(tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      t = { tex, w: img.naturalWidth, h: img.naturalHeight };
      texes.set(img, t);
    }
    return t;
  };

  let view = { w: 0, h: 0 };
  let dev = { w: 0, h: 0 };
  let lastDpr = 0;
  let lastRows: number | undefined;
  // Only a join needs these: the two shots drawn apart, and the mask that picks between them.
  let ta: Target | null = null;
  let tb: Target | null = null;
  let maskTex: WebGLTexture | null = null;
  let mask = new Uint8ClampedArray(0);
  let maskKey = "";
  const target = (w: number, h: number): Target => {
    const tex = gl.createTexture()!;
    setup(tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex };
  };
  const freeTarget = (t: Target | null) => {
    if (!t) return;
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.tex);
  };
  const freeJoin = () => {
    freeTarget(ta);
    freeTarget(tb);
    gl.deleteTexture(maskTex);
    ta = tb = maskTex = null;
    maskKey = "";
  };

  /** One shot at rest, into `fbo` (null: the canvas). */
  const shot = (d: ShotDraw, timeMs: number, fbo: WebGLFramebuffer | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, view.w, view.h);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); // the layers' alpha is 1 bit, so this never makes a new colour
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(uDst, view.w, view.h);
    for (const p of placements(d.scene, d.cam, timeMs, d.t, view)) {
      const t = texOf(p.img);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform4f(uRect, p.dx, p.dy, p.sw, p.sh);
      gl.uniform4f(uSrc, p.sx / t.w, p.sy / t.h, (p.sx + p.sw) / t.w, (p.sy + p.sh) / t.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  const join = (a: ShotDraw, j: JoinDraw, timeMs: number) => {
    ta ??= target(view.w, view.h);
    tb ??= target(view.w, view.h);
    if (!maskTex) {
      maskTex = gl.createTexture()!;
      setup(maskTex);
      mask = new Uint8ClampedArray(view.w * view.h * 4);
    }
    shot(a, timeMs, ta.fbo);
    shot(j.b, timeMs, tb.fbo);
    const jv = joinView(a, j, view);
    const key = joinKey(j, jv);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    if (key !== maskKey) {
      maskKey = key;
      joinMask(mask, view, j.kind, j.mix, jv);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, view.w, view.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tb.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ta.tex);
    const { a: za, b: zb } = planOf(a, j, view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.useProgram(jprog);
    gl.uniform2f(jView, view.w, view.h);
    gl.uniform4f(jZa, za.ax, za.ay, za.dx, za.dy);
    gl.uniform4f(jZb, zb.ax, zb.ay, zb.dx, zb.dy);
    gl.uniform2f(jZ, za.z, zb.z);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    resize(d, rows) {
      const dpr = devicePixelRatio || 1;
      if (d.w === dev.w && d.h === dev.h && dpr === lastDpr && rows === lastRows) return; // browser zoom moves dpr and the CSS size, not the device size
      dev = { ...d };
      lastDpr = dpr;
      lastRows = rows;
      const v = sizeCanvas(canvas, d, rows).view;
      if (v.w === view.w && v.h === view.h) return;
      view = v;
      freeJoin();
    },
    draw(timeMs, a, j) {
      if (!view.w) return;
      if (j) join(a, j, timeMs);
      else shot(a, timeMs, null);
    },
    free(scene: LoadedScene) {
      for (const img of [...scene.layers, scene.atlas]) {
        const t = texes.get(img);
        if (t) gl.deleteTexture(t.tex);
        texes.delete(img);
      }
    },
    dispose() {
      for (const t of texes.values()) gl.deleteTexture(t.tex);
      texes.clear();
      freeJoin();
      gl.deleteProgram(prog);
      gl.deleteProgram(jprog);
    },
  };
}
