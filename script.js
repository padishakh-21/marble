/*********
 * made by Matthias Hurrle (@atzedent)
 */

/** @type {HTMLCanvasElement} */
const canvas = window.canvas
const gl = canvas.getContext('webgl')
const dpr = window.devicePixelRatio

const vertexSource = `
 #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
 
  attribute vec2 position;
 
  void main(void)
  {
    gl_Position = vec4(position, 0., 1.);
  }
`
const fragmentSource = `
/*********
 * made by Matthias Hurrle (@atzedent)
 */

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 resolution;
uniform float time;
uniform vec2 pointers[10];

#define MAX_STEPS 64
#define PI radians(180.)
#define TAU (2. * PI)
#define T time * .25
#define mouse pointers[0]

vec2 cmul(vec2 a, vec2 b) {
    return vec2(
        a.x * b.x - a.y * b.y,
        a.x * b.y + a.y * b.x
    );
}

vec2 csqr(vec2 a) {
    return vec2(
        a.x * a.x - a.y * a.y,
        2. * a.x * a.y
    );
}

float Swirls(in vec3 p) {
    float res = .0;
    vec3 c = p;

    for(int i = 0; i < 11; ++ i) {
        p = .7 * abs(p) / dot(p, p) - .7;
        p.yz = csqr(p.yz);
        p = p.zxy;
        res += exp(-19. * abs(dot(p, c)));
        
    }
    return res * .5;
}

mat2 Rot(float a) {
    float s = sin(a), c = cos(a);
    
    return mat2(c, - s, s, c);
}

vec2 Sphere(in vec3 ro, in vec3 rd) {
    vec3 oc = ro;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - 4.;
    float h = b * b - c;

    if (h < .0) {
        return vec2(-1.);
    }
    
    h = sqrt(h);

    return vec2(-b - h, - b + h);
}

vec3 RayMarch(in vec3 ro, vec3 rd, vec2 mm) {
    float dt = .2 - .18 * cos(T * .75);
    float t = mm.x;
    float c = .0;
    
    vec3 col = vec3(0.0);

    for(int i = 0; i < MAX_STEPS; i++) {
        t += dt * exp(-2. * c);

        if (t > mm.y) {
            break;
        }
        
        c = Swirls(ro + rd * t);
        
        col += vec3(c, c * c, c) * .05;
    }
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float mn = min(resolution.x, resolution.y);
    float mx = max(resolution.x, resolution.y);
    vec2 uv = (
        2. * fragCoord.xy - resolution.xy
    ) / mix(mn, mx, .5 + .5 * sin(T));
    uv *= .5;
 
    vec2 m = mouse.xy / resolution.xy;
    vec3 ro = vec3(.0, 3., -6.);
    ro.yz *= Rot(mouse.x > 0.0 ? -m.y * PI + 1. : cos(T));
    ro.xz *= Rot(mouse.x > 0.0 ? m.x * TAU : sin(T));    

    vec3 ww = normalize(-ro);
    vec3 uu = normalize(cross(ww, vec3(.0, 1., .0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(uv.x * uu + uv.y * vv + ww);
    
    vec2 mm = Sphere(ro, rd);
    vec3 col = RayMarch(ro, rd, mm);
    
    if (mm.x < .0) {
        col = vec3(.0);
    } else {
        vec3 d = (ro + mm.x * rd) * .3;
        d = reflect(rd, d);
        vec3 refr = refract(rd, d, .85);
        float fres = pow(.125 + clamp(dot(d, rd), .0, 1.), 3.) * .3;
        fres += pow(.5 + clamp(dot(refr, rd), .0, .0), 3.) * .3;
        col += fres;
    }

    col = .5 * (log(1. + col));
    col = clamp(col, .0, 1.);

    fragColor = vec4(col, 1.);
}

void main() {
    vec4 fragment_color;
    
    mainImage(fragment_color, gl_FragCoord.xy);
    
    gl_FragColor = fragment_color;
}
`
const mouse = {
  /** @type {[number,number][]} */
  points: [],
  clear: function () {
    this.points = []
  },
  /** @param {[number,number]} point */
  add: function (point) {
    this.points.push(point)
  }
}

let time;
let buffer;
let program;
let resolution;
let pointers;
let vertices = []
let touches = [0, 0]

function resize() {
  const {
    innerWidth: width,
    innerHeight: height
  } = window

  canvas.width = width * dpr
  canvas.height = height * dpr

  gl.viewport(0, 0, width * dpr, height * dpr)
}

function compile(shader, source) {
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
  }
}

function setup() {
  const vs = gl.createShader(gl.VERTEX_SHADER)
  const fs = gl.createShader(gl.FRAGMENT_SHADER)

  program = gl.createProgram()

  compile(vs, vertexSource)
  compile(fs, fragmentSource)

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program))
  }

  vertices = [
    -1.0, -1.0,
    1.0, -1.0,
    -1.0, 1.0,
    -1.0, 1.0,
    1.0, -1.0,
    1.0, 1.0
  ]

  buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

  const position = gl.getAttribLocation(program, "position")

  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  time = gl.getUniformLocation(program, "time")
  resolution = gl.getUniformLocation(program, 'resolution')
  pointers = gl.getUniformLocation(program, 'pointers')
}

function draw(now) {
  gl.clearColor(0, 0, 0, 1.)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

  gl.uniform1f(time, (now / 1000))
  gl.uniform2f(
    resolution,
    canvas.width,
    canvas.height
  )
  gl.uniform2fv(pointers, touches);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length * .5)
}

function loop(now) {
  draw(now)

  requestAnimationFrame(loop)
}

function init() {
  setup()
  resize()
  loop(0)
}

function clearTouches() {
  for (let i = 0; i < touches.length; i++) {
    touches[i] = .0
  }
}

/** @param {TouchEvent} e */
function handleTouch(e) {
  const { height } = canvas

  clearTouches()

  let i = 0
  for (let touch of e.touches) {
    const { clientX: x, clientY: y } = touch

    touches[i++] = x * dpr
    touches[i++] = height - y * dpr
  }
}

/** @param {{ clientX: number, clientY: number }[]} other */
function mergeMouse(other) {
  return [
    ...mouse.points.map(([clientX, clientY]) => { return { clientX, clientY } }),
    ...other]
}

init()

canvas.ontouchstart = handleTouch
canvas.ontouchmove = handleTouch
canvas.ontouchend = clearTouches

window.onresize = resize

function handleMouseMove(e) {
  handleTouch({
      touches: mergeMouse([{ clientX: e.clientX, clientY: e.clientY }])
    })
}

function handleMouseDown() {
  canvas.addEventListener("mousemove", handleMouseMove)
}

function handleMouseUp() {
  canvas.removeEventListener("mousemove", handleMouseMove)
  
  clearTouches()
  handleTouch({ touches: mergeMouse([]) })
}

if (!window.matchMedia("(pointer: coarse)").matches) {
  canvas.addEventListener("mousedown", handleMouseDown)
  canvas.addEventListener("mouseup", handleMouseUp)
}
