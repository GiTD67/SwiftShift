import { useEffect, useRef } from 'react'

const VERT = `attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}`

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;
uniform float u_mouseDown;
uniform float u_clickPulse;
uniform vec3  u_ripples[6];
uniform int   u_rippleCount;
uniform vec4  u_shoot[8];
uniform float u_shootAge[8];
uniform int   u_shootCount;
uniform float u_gravity;
uniform float u_starDensity;
uniform float u_nebula;
uniform float u_galaxy;
uniform float u_lens;
uniform float u_hue;
uniform float u_speed;
uniform float u_preset;

float hash12(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 hash22(vec2 p){
  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
  return -1.0+2.0*fract(sin(p)*43758.5453);
}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(dot(hash22(i),f),dot(hash22(i+vec2(1,0)),f-vec2(1,0)),u.x),
             mix(dot(hash22(i+vec2(0,1)),f-vec2(0,1)),dot(hash22(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<3;i++){v+=a*vnoise(p);p=p*2.03+vec2(1.7,0.3);a*=0.5;}
  return v;
}

vec3 bg(){
  if(u_preset<0.5) return vec3(0.004,0.006,0.015);
  if(u_preset<1.5) return vec3(0.002,0.010,0.018);
  return vec3(0.010,0.005,0.012);
}
vec3 tintA(){
  if(u_preset<0.5) return vec3(0.10,0.18,0.42);
  if(u_preset<1.5) return vec3(0.05,0.35,0.30);
  return vec3(0.55,0.18,0.12);
}
vec3 tintB(){
  if(u_preset<0.5) return vec3(0.28,0.14,0.48);
  if(u_preset<1.5) return vec3(0.18,0.22,0.55);
  return vec3(0.40,0.08,0.38);
}
vec3 tintC(){
  if(u_preset<0.5) return vec3(0.45,0.55,0.85);
  if(u_preset<1.5) return vec3(0.45,0.80,0.70);
  return vec3(0.95,0.55,0.35);
}

vec3 stars(vec2 p,float scale,float density,vec3 baseTint){
  vec2 g=p*scale;
  vec2 id=floor(g);
  vec2 fr=fract(g)-0.5;
  float h=hash12(id);
  if(h>density) return vec3(0.0);
  vec2 jitter=(vec2(hash12(id+0.13),hash12(id+0.71))-0.5)*0.6;
  vec2 f=fr-jitter;
  float d2=dot(f,f);
  float b=hash12(id+3.7);
  float bright=pow(b,5.0);
  float sigma=mix(0.06,0.14,bright);
  float s=exp(-d2/(sigma*sigma));
  float phase=hash12(id+0.27)*6.28;
  float tw=0.7+0.3*sin(u_time*(0.5+b*1.2)+phase);
  s*=tw;
  float ch=hash12(id+0.91);
  vec3 col=mix(vec3(1.0,0.92,0.82),vec3(0.82,0.90,1.05),ch);
  col=mix(col,baseTint,0.15);
  return col*s*(0.12+bright*0.9);
}

vec3 galaxy(vec2 p,vec2 center,float size,float angle,float flatten,vec3 core,vec3 halo){
  vec2 d=p-center;
  float c=cos(angle),s=sin(angle);
  d=mat2(c,-s,s,c)*d;
  d.y/=flatten;
  float r=length(d);
  float body=exp(-pow(r/size,1.6)*6.0);
  float a=atan(d.y,d.x);
  float arm=0.5+0.5*sin(a*2.0+log(r+0.002)*5.5);
  float arms=arm*exp(-pow(r/size,1.4)*5.0)*0.25;
  float hv=exp(-r/size*2.5)*0.12;
  return core*(body+arms)+halo*hv;
}

vec3 allGalaxies(vec2 p,float t){
  vec3 c=vec3(0.0);
  c+=galaxy(p,vec2(-0.42+sin(t*0.006)*0.01,0.18),0.032,0.6,0.45,tintC()*0.7,tintB()*0.6);
  c+=galaxy(p,vec2(0.31+cos(t*0.008)*0.01,-0.22),0.038,-0.9,0.40,vec3(1.0,0.92,0.82)*0.55,tintA()*0.7);
  c+=galaxy(p,vec2(0.08+sin(t*0.005)*0.008,0.33),0.022,2.1,0.35,vec3(0.85,0.90,1.0)*0.55,tintB()*0.5);
  c+=galaxy(p,vec2(-0.18+cos(t*0.007)*0.008,-0.34),0.026,1.4,0.50,vec3(1.0,0.80,0.85)*0.45,tintA()*0.5);
  c+=galaxy(p,vec2(0.48,0.10),0.018,0.2,0.55,tintC()*0.4,tintB()*0.4);
  return c;
}

vec3 nebula(vec2 p,float t){
  float n1=fbm(p*0.9+vec2(t*0.008,0.0));
  float d1=smoothstep(0.35,0.80,n1);
  vec3 a=tintA(),b=tintB();
  float h=u_hue*6.2831;
  mat2 rot=mat2(cos(h),-sin(h)*0.3,sin(h)*0.3,cos(h));
  a.rg=rot*a.rg;
  b.gb=rot*b.gb;
  return mix(a,b,n1*0.5+0.5)*d1*0.7;
}

vec3 shootingStar(vec2 p,vec4 s,float age){
  if(age<=0.0||age>=1.0) return vec3(0.0);
  vec2 dir=s.zw;
  vec2 perp=vec2(-dir.y,dir.x);
  float travel=age*2.0;
  vec2 head=s.xy+dir*travel;
  vec2 rel=p-head;
  float along=dot(rel,-dir);
  float across=dot(rel,perp);
  float trailLen=0.35;
  float tl=clamp(along/trailLen,0.0,1.0);
  float w=mix(0.0015,0.0,tl);
  float pxw=fwidth(across)*0.8;
  float trail=(1.0-smoothstep(w,w+pxw,abs(across)))*(1.0-tl);
  trail*=step(0.0,along);
  float headGlow=exp(-dot(rel,rel)*8000.0);
  float fade=(1.0-age)*(1.0-age);
  vec3 col=mix(vec3(1.0,0.95,0.85),vec3(0.75,0.85,1.0),tl);
  return col*(trail*0.9+headGlow*1.8)*fade;
}

vec2 lensWarp(vec2 p,vec2 c,float strength,float radius){
  vec2 d=p-c;
  float r=length(d);
  float influence=exp(-pow(r/radius,2.0)*1.8);
  float bulge=influence*(r/radius)*(1.0-r/radius)*8.0;
  return p-normalize(d+1e-5)*bulge*strength*0.05;
}

vec3 sampleScene(vec2 uv,float t){
  vec3 col=bg();
  col+=tintA()*0.015*(0.6+uv.y);
  col+=nebula(uv*1.6+vec2(u_mouse.x*0.01,u_mouse.y*0.008),t)*0.22*u_nebula;
  col+=allGalaxies(uv,t)*u_galaxy;
  vec2 par=u_mouse*0.012;
  float sd=u_starDensity;
  col+=stars(uv+par*0.25,70.0,0.09*sd,tintC())*0.9;
  col+=stars(uv+par*0.55,140.0,0.07*sd,tintC())*0.55;
  col+=stars(uv+par*0.9,240.0,0.05*sd,vec3(1.0))*0.30;
  return col;
}

void main(){
  vec2 frag=gl_FragCoord.xy;
  vec2 uv=(frag-0.5*u_res)/u_res.y;
  vec2 mouse=vec2(u_mouse.x*(u_res.x/u_res.y),u_mouse.y)*0.5;
  float t=u_time*u_speed;
  float lensR=mix(0.15,0.26,u_mouseDown)+u_clickPulse*0.08;
  float lensStr=u_lens*u_gravity;
  vec2 warped=lensWarp(uv,mouse,lensStr,lensR);
  for(int i=0;i<6;i++){
    if(i>=u_rippleCount) break;
    vec2 rp=u_ripples[i].xy;
    float age=u_ripples[i].z;
    if(age<=0.0||age>2.0) continue;
    vec2 rd=uv-rp;
    float rr=length(rd);
    float waveR=age*0.75;
    float band=exp(-pow((rr-waveR)*12.0,2.0));
    float decay=(1.0-age*0.5)*(1.0-age*0.5);
    warped-=normalize(rd+1e-5)*band*decay*0.012;
  }
  vec3 col=sampleScene(warped,t);
  float r=length(uv-mouse);
  float rim=exp(-pow((r-lensR*0.88)*16.0,2.0))*0.06*lensStr;
  col+=vec3(0.9,0.95,1.0)*rim;
  float sheen=exp(-r*r*140.0)*(0.05+u_mouseDown*0.08+u_clickPulse*0.15);
  col+=vec3(0.75,0.85,1.0)*sheen;
  for(int i=0;i<6;i++){
    if(i>=u_rippleCount) break;
    vec2 rp=u_ripples[i].xy;
    float age=u_ripples[i].z;
    if(age<=0.0||age>2.0) continue;
    float rr=length(uv-rp);
    float waveR=age*0.75;
    float band=exp(-pow((rr-waveR)*14.0,2.0));
    float decay=(1.0-age*0.5);
    col+=vec3(0.7,0.82,1.0)*band*decay*0.06;
  }
  for(int i=0;i<8;i++){
    if(i>=u_shootCount) break;
    col+=shootingStar(uv,u_shoot[i],u_shootAge[i]);
  }
  float v=1.0-dot(uv*0.85,uv*0.85);
  col*=mix(0.55,1.0,clamp(v,0.0,1.0));
  float grain=hash12(frag+u_time)-0.5;
  col+=grain*0.006;
  col=pow(max(col,0.0),vec3(0.94));
  gl_FragColor=vec4(col,1.0);
}
`

interface ShootingStar {
  sx: number; sy: number; dx: number; dy: number; born: number; life: number
}

interface Ripple {
  x: number; y: number; born: number
}

export function GravityGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return
    gl.getExtension('OES_standard_derivatives')

    function compileShader(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      return s
    }

    const vert = compileShader(gl.VERTEX_SHADER, VERT)
    const frag = compileShader(gl.FRAGMENT_SHADER, FRAG)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uniformNames = [
      'u_res','u_time','u_mouse','u_mouseDown','u_clickPulse',
      'u_ripples[0]','u_rippleCount','u_shoot[0]','u_shootAge[0]','u_shootCount',
      'u_gravity','u_starDensity','u_nebula','u_galaxy','u_lens','u_hue','u_speed','u_preset',
    ] as const
    const U = Object.fromEntries(uniformNames.map(n => [n, gl.getUniformLocation(prog, n)])) as Record<string, WebGLUniformLocation | null>

    const MAX_R = 6, MAX_S = 8
    const state = { gravity: 1.0, starDensity: 1.8, nebulaIntensity: 0.7, galaxyIntensity: 0.8, lensStrength: 1.0, hueShift: 0.3, speed: 0.8, preset: 0 }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.floor(window.innerWidth * dpr)
      canvas!.height = Math.floor(window.innerHeight * dpr)
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }
    resize()

    let mx = 0, my = 0, tx = 0, ty = 0
    let down = 0, clickPulse = 0
    const ripples: Ripple[] = []
    const shoots: ShootingStar[] = []

    function spawnShooting() {
      const angle = Math.random() * Math.PI * 2
      const dx = Math.cos(angle), dy = Math.sin(angle)
      const aspect = window.innerWidth / window.innerHeight
      shoots.push({
        sx: -dx * 1.2 * aspect * 0.5,
        sy: -dy * 1.2 * 0.5,
        dx, dy,
        born: performance.now() / 1000,
        life: 2.2 + Math.random() * 1.6,
      })
      if (shoots.length > MAX_S) shoots.shift()
    }

    function onMouseMove(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }

    const shootInterval = setInterval(() => { if (Math.random() < 0.45) spawnShooting() }, 4800)
    window.addEventListener('resize', resize)
    document.addEventListener('mousemove', onMouseMove)

    let animId: number
    const t0 = performance.now()
    let last = t0

    function frame() {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000

      mx += (tx - mx) * Math.min(1, dt * 22)
      my += (ty - my) * Math.min(1, dt * 22)
      clickPulse *= Math.pow(0.02, dt)

      gl!.uniform2f(U['u_res']!, canvas!.width, canvas!.height)
      gl!.uniform1f(U['u_time']!, t)
      gl!.uniform2f(U['u_mouse']!, mx, my)
      gl!.uniform1f(U['u_mouseDown']!, down)
      gl!.uniform1f(U['u_clickPulse']!, clickPulse)

      const rData = new Float32Array(MAX_R * 3)
      let rCount = 0
      for (let i = 0; i < ripples.length && rCount < MAX_R; i++) {
        const age = t - ripples[i].born
        if (age >= 2.0) continue
        rData[rCount*3+0] = ripples[i].x
        rData[rCount*3+1] = ripples[i].y
        rData[rCount*3+2] = age
        rCount++
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (t - ripples[i].born >= 2.0) ripples.splice(i, 1)
      }
      gl!.uniform3fv(U['u_ripples[0]']!, rData)
      gl!.uniform1i(U['u_rippleCount']!, rCount)

      const sData = new Float32Array(MAX_S * 4)
      const ages = new Float32Array(MAX_S)
      let sCount = 0
      for (let i = 0; i < shoots.length && sCount < MAX_S; i++) {
        const age = (t - shoots[i].born) / shoots[i].life
        if (age >= 1.0 || age < 0) continue
        sData[sCount*4+0] = shoots[i].sx
        sData[sCount*4+1] = shoots[i].sy
        sData[sCount*4+2] = shoots[i].dx
        sData[sCount*4+3] = shoots[i].dy
        ages[sCount] = age
        sCount++
      }
      for (let i = shoots.length - 1; i >= 0; i--) {
        if ((t - shoots[i].born) / shoots[i].life >= 1.0) shoots.splice(i, 1)
      }
      gl!.uniform4fv(U['u_shoot[0]']!, sData)
      gl!.uniform1fv(U['u_shootAge[0]']!, ages)
      gl!.uniform1i(U['u_shootCount']!, sCount)

      gl!.uniform1f(U['u_gravity']!, state.gravity)
      gl!.uniform1f(U['u_starDensity']!, state.starDensity)
      gl!.uniform1f(U['u_nebula']!, state.nebulaIntensity)
      gl!.uniform1f(U['u_galaxy']!, state.galaxyIntensity)
      gl!.uniform1f(U['u_lens']!, state.lensStrength)
      gl!.uniform1f(U['u_hue']!, state.hueShift)
      gl!.uniform1f(U['u_speed']!, state.speed)
      gl!.uniform1f(U['u_preset']!, state.preset)

      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(shootInterval)
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMouseMove)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  )
}
