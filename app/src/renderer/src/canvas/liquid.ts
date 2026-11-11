// The Orchestrator's face: the integral suspended in a bead of liquid glass, drawn live in
// WebGL2. Ported from ideation/nocturne/orchestrator-states.html (the shader, the state table
// and the timings are that page's; change them there first). OrchestratorFace.tsx mounts it.
//
// Cost guards: one shared animation loop; it stops while the window is hidden or not focused;
// a face at rest draws at 30fps and at 60 only while something is happening; small faces
// render at pixel ratio 1; reduced motion keeps the colour changes and stops the movement.

const INTEGRAL =
  'M5.04938 9.20016C5.41453 4.86797 5.71359 0 9.30094 0C10.4972 0 11.7 1.00031 11.7 1.98469C11.7 3.5625 9.50766 3.5625 9.50766 1.98469C9.50766 1.43391 10.0317 1.13344 9.66656 0.766875C8.83594 -0.0665625 7.90594 1.36687 7.5075 2.93391C7.10859 4.50094 6.85031 6.83484 6.65062 9.20016C6.28547 13.5319 5.98641 18.3998 2.39906 18.3998C1.20281 18.3998 0 17.3995 0 16.4156C0 14.8373 2.19234 14.8373 2.19234 16.4156C2.19234 16.9664 1.66828 17.2664 2.03344 17.633C2.86406 18.4669 3.79406 17.033 4.1925 15.4659C4.59141 13.8989 4.84969 11.565 5.04938 9.20016Z'

const VS = `#version 300 es
in vec2 a;out vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}`

const FS = `#version 300 es
precision highp float;
in vec2 v;out vec4 o;
uniform float uT,uR,uFlow,uSwirl,uWob,uSat,uInk,uDisp,uRot,uScale,uHaloA,uFlood,uPx;
uniform vec2 uOff,uSquash,uImp;
uniform vec3 uDeep,uMid,uHi,uHalo,uRim,uInkCol,uFloodCol;
uniform vec4 uDrops[4];uniform vec3 uDropCol[4];
uniform sampler2D uGlyph;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hs(i),hs(i+vec2(1,0)),u.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*ns(p);p=m*p;a*=.5;}return s;}
float field(vec2 p){
 vec2 q=(p-uOff)/uSquash;
 float an=atan(q.y,q.x);
 float w=(ns(vec2(cos(an),sin(an))*1.4+uT*.16)-.5)*2.;
 float w2=(ns(vec2(cos(an),sin(an))*3.1-uT*.2)-.5);
 float rip=uImp.y*exp(-uImp.x*1.3)*sin(an*3.-uImp.x*3.5);
 float r=uR*(1.+uWob*(w*.045+w2*.02)+rip*.035);
 float F=r*r/max(dot(q,q),1e-5);
 for(int i=0;i<4;i++){vec2 d=p-uDrops[i].xy;F+=uDrops[i].w*uDrops[i].z*uDrops[i].z/max(dot(d,d),1e-5);}
 return F;}
float zf(float F){return sqrt(max(0.,1.-1./F));}
void main(){
 vec2 p=v;
 float F=field(p);
 float hz=sqrt(1./max(F,1e-6));
 float inside=clamp((1.-hz)/max(fwidth(hz),1e-4)+.5,0.,1.);
 float halo=exp(-max(hz-1.,0.)*3.2)*uHaloA*(1.-inside);
 if(inside<=0.){o=vec4(uHalo*halo,halo);return;}
 float e=uPx*1.5;
 float z=zf(F);
 float zx=zf(field(p+vec2(e,0.))),zy=zf(field(p+vec2(0.,e)));
 vec3 n=normalize(vec3(-(zx-z)/e*.5,-(zy-z)/e*.5,1.));
 float t=uT*uFlow;
 // surface micro-waves and key ripples
 vec2 sw=vec2(fbm(p*6.+t*.8),fbm(p*6.-t*.7+3.1))-.5;
 n.xy+=sw*.12*(.35+uDisp);
 float rr=length(p-uOff)/uR;
 n.xy+=normalize(p-uOff+1e-5)*sin(rr*9.-uImp.x*4.5)*exp(-uImp.x*1.2)*uImp.y*.08*step(rr,1.);
 n=normalize(n);
 // refraction: magnify the interior like a glass bead
 vec2 q=(p-uOff)*(.72+.28*(1.-z))-n.xy*.05;
 // swirling liquid interior (domain warp)
 float c=cos(uSwirl*t*.5),s=sin(uSwirl*t*.5);
 vec2 w=mat2(c,-s,s,c)*q*2.4;
 vec2 w1=vec2(fbm(w+vec2(0.,t)),fbm(w+vec2(5.2,1.3)-t*.7));
 vec2 w2=vec2(fbm(w+2.2*w1+vec2(1.7,9.2)+t*.3),fbm(w+2.2*w1+vec2(8.3,2.8)-t*.25));
 float m=fbm(w+2.4*w2);
 vec3 liq=mix(uDeep,uMid,smoothstep(.2,.7,m));
 liq=mix(liq,uHi,smoothstep(.55,.95,m)*.85);
 // droplets carry their musician's colour into the body
 for(int i=0;i<4;i++){vec2 d=p-uDrops[i].xy;float k=uDrops[i].w*uDrops[i].z*uDrops[i].z/max(dot(d,d),1e-5);
  liq=mix(liq,uDropCol[i],clamp(k*1.4-.15,0.,.85)*uDrops[i].w);}
 // done: colour floods up from the bottom
 float lvl=mix(-1.25,1.25,uFlood)+.05*sin((p.x/uR)*6.+uT*1.1);
 float fl=smoothstep(lvl+.12,lvl-.12,(p.y-uOff.y)/uR)*step(.001,uFlood);
 liq=mix(liq,mix(uFloodCol,uFloodCol*(.5+m),.5),fl*.75);
 // light passing through: a bright crescent low in the bead
 float cr=smoothstep(.1,.95,-q.y/uR)*pow(1.-z,1.5);
 liq+=uHi*cr*.55;
 liq*=mix(.6,1.05,z);
 // the integral, suspended in the liquid
 vec2 g=q;float cr2=cos(-uRot),sr2=sin(-uRot);g=mat2(cr2,-sr2,sr2,cr2)*g/uScale;
 vec2 gd=(vec2(fbm(g*5.+t*1.3),fbm(g*5.-t*1.1+4.))-.5)*uDisp*.16;
 vec2 tuv=(g+gd)/.6+.5;tuv.y=1.-tuv.y;
 float ink=texture(uGlyph,tuv).a*uInk;
 float shd=texture(uGlyph,tuv+vec2(-.022,-.035)).a*uInk;
 vec3 col=mix(liq,liq*.45,shd*.55);
 col=mix(col,uInkCol*mix(.9,1.05,z),ink);
 float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,uSat);
 // glass lighting
 float fr=pow(1.-n.z,2.6);
 col+=uRim*fr*.85;
 vec3 L=normalize(vec3(-.45,.62,.72));vec3 H=normalize(L+vec3(0.,0.,1.));
 float sp=pow(max(dot(n,H),0.),110.)*1.5+pow(max(dot(n,H),0.),14.)*.16;
 vec3 L2=normalize(vec3(.6,-.5,.6));vec3 H2=normalize(L2+vec3(0.,0.,1.));
 sp+=pow(max(dot(n,H2),0.),60.)*.35;
 col+=vec3(sp);
 vec3 outc=col*inside+uHalo*halo;
 o=vec4(outc,inside+halo);
}`

export type FaceState =
  'idle' | 'listening' | 'sent' | 'thinking' | 'working' | 'needs' | 'done' | 'error'

type Rgb = [number, number, number]
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255
]

// what a state sets: colours as hex, the rest as plain numbers
type Look = Record<string, string | number>
const BASE: Look = {
  deep: '#021673',
  mid: '#0538FF',
  hi: '#8FA6FF',
  halo: '#0538FF',
  rim: '#9DB2FF',
  inkc: '#F4F2EE',
  floodc: '#6FDC8C',
  haloA: 0.42,
  flow: 0.11,
  swirl: 0.2,
  wob: 0.45,
  sat: 1,
  ink: 1,
  disp: 0.12,
  lean: 0,
  drops: 0,
  flood: 0
}
const LOOKS: Record<FaceState, Look> = {
  idle: {},
  listening: {
    hi: '#A9BBFF',
    halo: '#5B7CFF',
    haloA: 0.55,
    flow: 0.14,
    wob: 0.55,
    lean: -0.12,
    rim: '#B9C7FF'
  },
  sent: { hi: '#C2CFFF', halo: '#5B7CFF', haloA: 0.62, flow: 0.2, wob: 0.6, rim: '#C9D4FF' },
  thinking: {
    deep: '#0E1452',
    mid: '#2A3FE0',
    hi: '#C9C7FF',
    halo: '#B7B5FF',
    haloA: 0.5,
    rim: '#D4D2FF',
    flow: 0.3,
    swirl: 0.45,
    wob: 0.7,
    ink: 0.85,
    disp: 0.9
  },
  working: {
    hi: '#9FB2FF',
    halo: '#5B7CFF',
    haloA: 0.5,
    flow: 0.22,
    wob: 0.5,
    drops: 1,
    disp: 0.25
  },
  needs: { halo: '#FFA24A', haloA: 0.45, rim: '#FFC48A', hi: '#B4BFFF', flow: 0.13, wob: 0.5 },
  done: { halo: '#6FDC8C', haloA: 0.42, rim: '#B5F0C4', flood: 1, flow: 0.16 },
  error: {
    deep: '#0E0E12',
    mid: '#2A2A32',
    hi: '#5C5C68',
    halo: '#FF5A5F',
    haloA: 0.32,
    rim: '#FF8A8D',
    inkc: '#C9C7C2',
    sat: 0.35,
    flow: 0.02,
    swirl: 0,
    wob: 0.12,
    disp: 0
  }
}
// one droplet per working Musician buds off, orbits and merges back
const DROPS = [
  { c: '#F6B89A', sp: 0.36, ph: 0 },
  { c: '#F2A7C3', sp: 0.28, ph: 1.6 },
  { c: '#B9E4A3', sp: 0.22, ph: 3.3 },
  { c: '#B7B5FF', sp: 0.32, ph: 4.7 }
]
const UNIFORMS = [
  'uT',
  'uR',
  'uFlow',
  'uSwirl',
  'uWob',
  'uSat',
  'uInk',
  'uDisp',
  'uRot',
  'uScale',
  'uHaloA',
  'uFlood',
  'uPx',
  'uOff',
  'uSquash',
  'uImp',
  'uDeep',
  'uMid',
  'uHi',
  'uHalo',
  'uRim',
  'uInkCol',
  'uFloodCol',
  'uDrops',
  'uDropCol',
  'uGlyph'
] as const

/** How much bigger than the face its canvas is, to leave room for the halo and droplets. */
export const BLEED = 2.36 // the bead itself then measures the size asked for
const R = 0.4235

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

let glyphCanvas: HTMLCanvasElement | null = null
function glyph(): HTMLCanvasElement {
  if (glyphCanvas) return glyphCanvas
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const s = (0.918 * 256) / 18.4
  x.translate(128, 128)
  x.scale(s, s)
  x.translate(-5.85, -9.2)
  x.fillStyle = 'white'
  x.fill(new Path2D(INTEGRAL))
  return (glyphCanvas = c)
}

type Value = number | Rgb

export class Liquid {
  private gl: WebGL2RenderingContext
  private cv: HTMLCanvasElement
  private u: Record<string, WebGLUniformLocation | null> = {}
  private cur: Record<string, Value> = {}
  private tgt: Record<string, Value> = {}
  private state: FaceState = 'idle'
  private t = Math.random() * 20
  private imp: [number, number] = [9, 0]
  private spin = 0
  private spinTgt = 0
  private squashAge = 9
  private shakeAge = 9
  private popAge = 9
  private dropW = [0, 0, 0, 0]
  private owed = 0 // time since this face last drew, for the 30fps rest rate
  private busyUntil = 0 // a one-shot is playing: draw every frame until then

  /** Throws if WebGL2 is missing or the shader will not build; the caller falls back. */
  constructor(cv: HTMLCanvasElement, size: number, state: FaceState) {
    this.cv = cv
    // even at 2x these canvases are under 200px a side, so the density costs little
    const dpr = Math.min(2, devicePixelRatio || 1)
    cv.width = cv.height = Math.round(size * BLEED * dpr)
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true })
    if (!gl) throw new Error('no webgl2')
    const shader = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const pr = gl.createProgram()!
    gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS))
    gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(pr) ?? 'program')
    gl.useProgram(pr)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const at = gl.getAttribLocation(pr, 'a')
    gl.enableVertexAttribArray(at)
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyph())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.gl = gl
    for (const k of UNIFORMS) this.u[k] = gl.getUniformLocation(pr, k)
    this.setState(state, true)
    for (const k in this.tgt) {
      const v = this.tgt[k]
      this.cur[k] = Array.isArray(v) ? ([...v] as Rgb) : v
    }
    this.frame(1 / 60, reduced()) // a first picture, even while the window is asleep
    faces.add(this)
    wake()
  }

  setState(s: FaceState, init = false): void {
    const d = { ...BASE, ...LOOKS[s] }
    this.state = s
    for (const k in d) {
      const v = d[k]
      this.tgt[k] = typeof v === 'string' ? hex(v) : v
    }
    if (init) return
    this.busyUntil = performance.now() + 2500
    if (s === 'sent') {
      this.kick(0.9)
      this.squashAge = 0
      this.spinTgt += Math.PI
    }
    if (s === 'error') this.shakeAge = 0
    if (s === 'done') {
      this.cur.flood = 0
      this.popAge = -0.9
    }
  }

  /** A ripple across the surface: a key press while listening, or a message sent. */
  kick(a: number): void {
    if (reduced()) return
    const amp = this.imp[1] * Math.exp(-this.imp[0] * 1.3)
    this.imp = [0, Math.min(1.1, amp + a)]
    this.busyUntil = Math.max(this.busyUntil, performance.now() + 1200)
  }

  dispose(): void {
    // the context is left for the browser to collect: a remount reuses this same canvas
    faces.delete(this)
  }

  /** Called by the shared loop every animation frame; decides for itself whether to draw. */
  tick(dt: number, now: number): void {
    this.owed += dt
    const rm = reduced()
    const lively = this.state !== 'idle' || now < this.busyUntil
    // at rest 30fps is plenty; reduced motion only needs the colours to arrive
    const every = rm ? 1 / 10 : lively ? 0 : 1 / 30
    if (this.owed < every) return
    this.frame(Math.min(0.05, this.owed), rm)
    this.owed = 0
  }

  private num(k: string): number {
    return this.cur[k] as number
  }
  private rgb(k: string): Rgb {
    return this.cur[k] as Rgb
  }

  private frame(dt: number, rm: boolean): void {
    const { gl, u, tgt: g } = this
    const k = 1 - Math.exp(-dt * (rm ? 30 : 1.7))
    for (const key in g) {
      const to = g[key]
      if (Array.isArray(to)) {
        const from = this.rgb(key)
        for (let i = 0; i < 3; i++) from[i] += (to[i] - from[i]) * k
      } else {
        const kk = key === 'flood' ? 1 - Math.exp(-dt * 0.85) : k
        this.cur[key] = this.num(key) + (to - this.num(key)) * kk
      }
    }
    if (!rm) {
      this.t += dt
      this.imp[0] += dt
      this.squashAge += dt
      this.shakeAge += dt
      this.popAge += dt
    }
    this.spin += (this.spinTgt - this.spin) * (1 - Math.exp(-dt * 1.8))
    const sq = rm ? 0 : 0.05 * Math.exp(-this.squashAge * 1.6) * Math.cos(this.squashAge * 4.2)
    const shake = rm ? 0 : 0.014 * Math.exp(-this.shakeAge * 1.1) * Math.sin(this.shakeAge * 3.2)
    const pop =
      this.popAge > 0 && !rm ? 0.05 * Math.exp(-this.popAge * 1.8) * Math.sin(this.popAge * 3.5) : 0
    const bob = this.state === 'working' && !rm ? Math.sin(this.t * 1.3) * 0.006 : 0
    const breathe = rm ? 0 : Math.sin(this.t * (this.state === 'idle' ? 1.05 : 1.4)) * 0.012
    let haloA = this.num('haloA')
    if (this.state === 'needs' && !rm)
      haloA *= 0.75 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin((this.t * Math.PI) / 1.5), 2)
    gl.viewport(0, 0, this.cv.width, this.cv.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(u.uT, this.t)
    gl.uniform1f(u.uR, R * (1 + breathe))
    gl.uniform1f(u.uFlow, this.num('flow'))
    gl.uniform1f(u.uSwirl, this.num('swirl'))
    gl.uniform1f(u.uWob, this.num('wob'))
    gl.uniform1f(u.uSat, this.num('sat'))
    gl.uniform1f(u.uInk, this.num('ink'))
    gl.uniform1f(u.uDisp, this.num('disp'))
    gl.uniform1f(u.uRot, this.num('lean') + this.spin + shake * 2)
    gl.uniform1f(u.uScale, 1 + pop)
    gl.uniform1f(u.uHaloA, haloA)
    gl.uniform1f(u.uFlood, this.num('flood'))
    gl.uniform1f(u.uPx, 2 / this.cv.width)
    gl.uniform2f(u.uOff, shake, bob)
    gl.uniform2f(u.uSquash, 1 + sq * 0.8, 1 - sq)
    gl.uniform2f(u.uImp, this.imp[0], this.imp[1])
    gl.uniform3fv(u.uDeep, this.rgb('deep'))
    gl.uniform3fv(u.uMid, this.rgb('mid'))
    gl.uniform3fv(u.uHi, this.rgb('hi'))
    gl.uniform3fv(u.uHalo, this.rgb('halo'))
    gl.uniform3fv(u.uRim, this.rgb('rim'))
    gl.uniform3fv(u.uInkCol, this.rgb('inkc'))
    gl.uniform3fv(u.uFloodCol, this.rgb('floodc'))
    const dv = new Float32Array(16)
    const dc = new Float32Array(12)
    const drops = this.num('drops')
    DROPS.forEach((d, i) => {
      this.dropW[i] += (drops - this.dropW[i]) * (1 - Math.exp(-dt * (0.7 + i * 0.25)))
      const a = this.t * d.sp + d.ph
      const dist = R * (1.2 + 0.24 * Math.sin(this.t * 0.38 + i * 1.9))
      dv.set(
        [Math.cos(a) * dist, Math.sin(a) * dist * 0.92, R * (i % 2 ? 0.24 : 0.2), this.dropW[i]],
        i * 4
      )
      dc.set(hex(d.c), i * 3)
    })
    gl.uniform4fv(u.uDrops, dv)
    gl.uniform3fv(u.uDropCol, dc)
    gl.uniform1i(u.uGlyph, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

/** A key press in the bar: a small ripple on every face. */
export function ripple(a = 0.3): void {
  for (const f of faces) f.kick(a)
  wake()
}

// ---- one loop for every face; asleep while the window is hidden or not focused ----
const faces = new Set<Liquid>()
let raf = 0
let last = 0
const awake = (): boolean => faces.size > 0 && !document.hidden && document.hasFocus()
function loop(now: number): void {
  raf = 0
  if (!awake()) return
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  for (const f of faces) f.tick(dt, now)
  raf = requestAnimationFrame(loop)
}
function wake(): void {
  if (raf || !awake()) return
  last = performance.now()
  raf = requestAnimationFrame(loop)
}
document.addEventListener('visibilitychange', wake)
addEventListener('focus', wake)
