import * as THREE from 'three'
import {
  concreteTextures, wetGroundTextures, metalTextures, crateTextures, chainlinkTexture,
  buildingWindowsTexture, signTexture, decalTexture, spriteTexture, envTexture
} from './textures.js'

export const ARENA = { minX: -34, maxX: 34, minZ: -34, maxZ: 34, size: 76 }

function rand(a = 0, b = 1) { return a + Math.random() * (b - a) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

export function createWorld(renderer) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x091017, 0.0185)

  const environment = envTexture()
  scene.environment = environment
  scene.environmentIntensity = 0.62

  const tex = {
    concrete: concreteTextures(7),
    ground: wetGroundTextures(12),
    metalTeal: metalTextures([42, 74, 76], 22, true),
    metalRust: metalTextures([92, 57, 38], 33, true),
    metalOlive: metalTextures([62, 68, 45], 44, true),
    metalBlue: metalTextures([40, 54, 66], 55, true),
    metalDark: metalTextures([44, 50, 52], 66, false),
    metalLight: metalTextures([112, 120, 118], 77, false),
    crate: crateTextures(31),
    chain: chainlinkTexture(),
    windows: buildingWindowsTexture(4),
  }
  tex.concrete.map.repeat.set(3, 3)
  tex.concrete.normalMap.repeat.set(3, 3)
  tex.concrete.roughnessMap.repeat.set(3, 3)

  const MAT = {
    ground: new THREE.MeshStandardMaterial({
      map: tex.ground.map, normalMap: tex.ground.normalMap, roughnessMap: tex.ground.roughnessMap,
      roughness: 0.95, metalness: 0.08, envMapIntensity: 0.95, color: 0xa5afb1,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: tex.concrete.map, normalMap: tex.concrete.normalMap, roughnessMap: tex.concrete.roughnessMap,
      roughness: 1, metalness: 0.02, color: 0x8f9898,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      map: tex.concrete.map, normalMap: tex.concrete.normalMap, roughnessMap: tex.concrete.roughnessMap,
      roughness: 1, metalness: 0.02, color: 0x5d6667,
    }),
    teal: new THREE.MeshStandardMaterial({ map: tex.metalTeal.map, normalMap: tex.metalTeal.normalMap, roughnessMap: tex.metalTeal.roughnessMap, roughness: 0.72, metalness: 0.62, color: 0x9aa9a5 }),
    rust: new THREE.MeshStandardMaterial({ map: tex.metalRust.map, normalMap: tex.metalRust.normalMap, roughnessMap: tex.metalRust.roughnessMap, roughness: 0.86, metalness: 0.48, color: 0xb19e8e }),
    olive: new THREE.MeshStandardMaterial({ map: tex.metalOlive.map, normalMap: tex.metalOlive.normalMap, roughnessMap: tex.metalOlive.roughnessMap, roughness: 0.8, metalness: 0.5, color: 0xa1a690 }),
    blue: new THREE.MeshStandardMaterial({ map: tex.metalBlue.map, normalMap: tex.metalBlue.normalMap, roughnessMap: tex.metalBlue.roughnessMap, roughness: 0.62, metalness: 0.7, color: 0x93a6b1 }),
    metalDark: new THREE.MeshStandardMaterial({ map: tex.metalDark.map, normalMap: tex.metalDark.normalMap, roughnessMap: tex.metalDark.roughnessMap, roughness: 0.5, metalness: 0.86, color: 0x9aa4a6 }),
    metalLight: new THREE.MeshStandardMaterial({ map: tex.metalLight.map, normalMap: tex.metalLight.normalMap, roughnessMap: tex.metalLight.roughnessMap, roughness: 0.44, metalness: 0.82, color: 0xa8b0ae }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate.map, normalMap: tex.crate.normalMap, roughness: 0.86, metalness: 0.05, color: 0xb6aa94 }),
    sandbag: new THREE.MeshStandardMaterial({ color: 0x857a5f, roughness: 0.97, metalness: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 0.92, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1a20, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.5 }),
    fence: new THREE.MeshStandardMaterial({ map: tex.chain, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide, color: 0xa4b2b8, roughness: 0.6, metalness: 0.7 }),
  }

  const colliders = []
  const raycastTargets = []
  const coverPoints = []
  const enemySpawnPoints = []
  const animated = []
  const flickerLights = []
  const beacons = []
  const platform = { minX: -6.4, maxX: 6.4, minZ: -5.4, maxZ: 5.4, height: 1.08, ramps: [{ x: 0, z0: 5.4, z1: 9.6, w: 4.6 }, { x: 0, z0: -5.4, z1: -9.6, w: 4.6 }] }

  function shadow(obj, cast = true, receive = true) {
    obj.traverse?.(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive } })
    return obj
  }
  function add(obj, { collide = false, ray = true, cast = true, receive = true, pad = 0 } = {}) {
    scene.add(obj)
    shadow(obj, cast, receive)
    if (ray) raycastTargets.push(obj)
    if (collide) {
      obj.updateWorldMatrix(true, true)
      const b = new THREE.Box3().setFromObject(obj)
      colliders.push({ minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad, minY: b.min.y, maxY: b.max.y })
    }
    return obj
  }
  function box(w, h, d, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z); m.rotation.y = ry
    return m
  }
  function cyl(rt, rb, h, mat, x, y, z, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
    m.position.set(x, y, z)
    return m
  }
  function emissiveStrip(w, h, d, color, intensity = 2.5) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: intensity, roughness: 0.5, metalness: 0.2 })
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  }
  function addCover(x, z) { coverPoints.push(new THREE.Vector3(x, 0, z)) }

  // ---------- sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, moonDir: { value: new THREE.Vector3(-0.42, 0.62, -0.66).normalize() } },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 vDir; uniform float time; uniform vec3 moonDir;
      float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      float noise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float n=mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
                    mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
        return n; }
      float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=noise(p)*a; p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 zenith = vec3(0.006,0.014,0.028);
        vec3 mid = vec3(0.028,0.055,0.082);
        vec3 horizon = vec3(0.105,0.135,0.155);
        vec3 col = mix(horizon, mid, smoothstep(0.0,0.22,h));
        col = mix(col, zenith, smoothstep(0.18,0.8,h));
        float glow = pow(max(0.0,1.0-h), 7.0);
        col += vec3(0.32,0.13,0.045) * glow * 0.55;
        col += vec3(0.16,0.08,0.03) * pow(max(0.0,1.0-h), 22.0) * 0.6;
        // moon
        float m = max(dot(d, moonDir), 0.0);
        col += vec3(1.0,0.98,0.9) * smoothstep(0.99955,0.99978,m) * 1.4;
        col += vec3(0.45,0.6,0.85) * pow(m, 90.0) * 0.7;
        col += vec3(0.22,0.36,0.55) * pow(m, 11.0) * 0.12;
        // stars
        vec3 sp = floor(d * 260.0);
        float st = hash13(sp);
        float star = smoothstep(0.9972, 0.9996, st) * smoothstep(0.02, 0.4, d.y);
        col += vec3(0.65,0.8,1.0) * star * (0.45 + 0.55*hash13(sp+9.0));
        // clouds
        vec2 cp = d.xz / (d.y + 0.22);
        float cl = fbm(vec3(cp*0.75 + vec2(time*0.004, time*0.0015), time*0.002));
        cl = smoothstep(0.42,0.82,cl) * smoothstep(0.0,0.28,d.y);
        col = mix(col, vec3(0.055,0.075,0.095), cl*0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 48, 32), skyMat)
  sky.renderOrder = -10
  scene.add(sky)

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight(0x506d88, 0x0a0c0d, 0.85)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight(0xb9d0e8, 2.0)
  moonLight.position.set(-38, 52, -50)
  moonLight.castShadow = true
  moonLight.shadow.mapSize.set(2048, 2048)
  moonLight.shadow.camera.left = -45; moonLight.shadow.camera.right = 45
  moonLight.shadow.camera.top = 45; moonLight.shadow.camera.bottom = -45
  moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 130
  moonLight.shadow.bias = -0.0006
  moonLight.shadow.normalBias = 0.03
  scene.add(moonLight)
  scene.add(moonLight.target)
  moonLight.target.position.set(0, 0, 0)

  const fill = new THREE.DirectionalLight(0x3f5f7a, 0.5)
  fill.position.set(30, 22, 24)
  scene.add(fill)

  // ---------- ground ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 190, 1, 1), MAT.ground)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  raycastTargets.push(ground)

  // puddle mirrors
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x11181c, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.55,
    envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  })
  for (let i = 0; i < 22; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.7, 2.6), 24), puddleMat)
    p.rotation.x = -Math.PI / 2
    p.scale.set(1, rand(0.45, 1.2), 1)
    p.rotation.z = rand(0, 7)
    const x = rand(-30, 30), z = rand(-30, 30)
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue
    p.position.set(x, 0.013, z)
    scene.add(p)
  }

  // ---------- perimeter walls ----------
  const wallH = 5.6, wallT = 0.85, half = 36.5
  const gateW = 9
  const wallSegs = []
  for (const side of ['n', 's', 'e', 'w']) {
    const horiz = side === 'n' || side === 's'
    const length = half * 2
    const segs = 2
    for (let s = 0; s < segs; s++) {
      const segLen = (length - gateW) / segs
      const offset = (gateW / 2) + segLen * (s + 0.5)
      const x = horiz ? offset : (side === 'e' ? half : -half)
      const z = horiz ? (side === 's' ? half : -half) : offset
      const w = horiz ? segLen : wallT
      const d = horiz ? wallT : segLen
      const wall = box(w, wallH, d, MAT.concrete, x, wallH / 2, z)
      wallSegs.push(add(wall, { collide: true, ray: true }))
      // cap
      const cap = box(w + 0.12, 0.22, d + 0.12, MAT.concreteDark, x, wallH + 0.08, z)
      add(cap, { ray: false, cast: false })
      // buttresses
      const count = Math.max(2, Math.round(segLen / 6))
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const bx = horiz ? x - w / 2 + t * w : x
        const bz = horiz ? z : z - d / 2 + t * d
        const but = box(horiz ? 0.42 : 0.9, wallH * 0.9, horiz ? 0.9 : 0.42, MAT.concreteDark, bx, wallH * 0.45, bz)
        add(but, { ray: false, cast: false })
      }
    }
  }
  // gates: chainlink doors, closed
  const gatePositions = [
    { x: 0, z: half, ry: 0, sx: gateW }, { x: 0, z: -half, ry: 0, sx: gateW },
    { x: half, z: 0, ry: Math.PI / 2, sx: gateW }, { x: -half, z: 0, ry: Math.PI / 2, sx: gateW },
  ]
  for (const g of gatePositions) {
    const frame = box(g.sx, 0.18, 0.18, MAT.metalDark, g.x, 4.6, g.z, g.ry)
    add(frame, { ray: false })
    for (let side = -1; side <= 1; side += 2) {
      const post = box(0.22, 5, 0.22, MAT.metalDark, g.x + (g.ry ? 0 : side * g.sx / 2), 2.5, g.z + (g.ry ? side * g.sx / 2 : 0))
      add(post, { ray: false })
    }
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(g.sx, 4.6), MAT.fence)
    gate.position.set(g.x, 2.3, g.z)
    gate.rotation.y = g.ry
    add(gate, { ray: false })
    const collider = box(g.sx, 4.6, 0.25, MAT.metalDark, g.x, 2.3, g.z, g.ry)
    collider.visible = false
    add(collider, { collide: true, ray: false, cast: false })
    // warning lights on gate
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a18 }))
    lamp.position.set(g.x, 4.9, g.z + (g.z > 0 ? -0.2 : g.z < 0 ? 0.2 : 0))
    const lamp2 = lamp.clone()
    lamp2.position.set(g.x + (g.x > 0 ? -0.2 : g.x < 0 ? 0.2 : 0), 4.9, g.z)
    scene.add(lamp, lamp2)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('glow'), color: 0xff2a18, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(1.4, 1.4, 1)
    glow.position.copy(lamp2.position)
    scene.add(glow)
    beacons.push({ lamp, lamp2, glow, phase: rand(0, 6) })
  }

  // barbed wire over walls
  const wireMat = new THREE.LineBasicMaterial({ color: 0x6c7b80, transparent: true, opacity: 0.45 })
  for (const side of [-1, 1]) {
    for (const axis of ['x', 'z']) {
      const pts = []
      const n = 90
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * 2 - 1
        const a = axis === 'x' ? t * half : side * half
        const b = axis === 'x' ? side * half : t * half
        pts.push(new THREE.Vector3(a, wallH + 0.32 + Math.sin(i * 1.7) * 0.05, b))
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat))
    }
  }

  // ---------- central platform ----------
  const platformGroup = new THREE.Group()
  const base = box(platform.maxX - platform.minX, platform.height, platform.maxZ - platform.minZ, MAT.metalDark, 0, platform.height / 2, 0)
  platformGroup.add(base)
  const pad = box(platform.maxX - platform.minX - 0.2, 0.1, platform.maxZ - platform.minZ - 0.2, MAT.metalLight, 0, platform.height + 0.05, 0)
  platformGroup.add(pad)
  // hazard trim
  for (const [x, z, w, d] of [
    [0, platform.maxZ - 0.1, platform.maxX - platform.minX - 0.3, 0.13],
    [0, platform.minZ + 0.1, platform.maxX - platform.minX - 0.3, 0.13],
    [platform.maxX - 0.1, 0, 0.13, platform.maxZ - platform.minZ - 0.3],
    [platform.minX + 0.1, 0, 0.13, platform.maxZ - platform.minZ - 0.3],
  ]) {
    const strip = emissiveStrip(w, 0.06, d, 0xff9a3c, 1.6)
    strip.position.set(x, platform.height + 0.08, z)
    platformGroup.add(strip)
  }
  // helipad decal
  const heli = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), new THREE.MeshBasicMaterial({ map: decalTexture('helipad'), transparent: true, opacity: 0.55, depthWrite: false }))
  heli.rotation.x = -Math.PI / 2
  heli.position.y = platform.height + 0.11
  platformGroup.add(heli)
  // ramps: z0 is the platform edge (top) and z1 the ground edge (bottom)
  const rampMat = MAT.metalDark.clone()
  rampMat.side = THREE.DoubleSide
  for (const r of platform.ramps) {
    const len = Math.abs(r.z1 - r.z0)
    const hyp = Math.hypot(len, platform.height)
    const slope = Math.atan2(platform.height, len) * Math.sign(r.z1 - r.z0)
    const ramp = box(r.w, 0.14, hyp, rampMat, 0, platform.height / 2 - 0.06, (r.z0 + r.z1) / 2)
    ramp.rotation.x = slope
    platformGroup.add(ramp)
    // side rails follow the slope
    for (const side of [-1, 1]) {
      const rail = box(0.06, 0.06, hyp, MAT.metalLight, side * (r.w / 2 + 0.05), platform.height * 0.55, (r.z0 + r.z1) / 2)
      rail.rotation.x = slope
      platformGroup.add(rail)
    }
  }
  add(platformGroup, { ray: true, collide: false })
  // cover crates on platform
  for (const [x, z] of [[-4.2, -3.2], [4.2, 3.2], [4.4, -3.4]]) {
    const c = box(1.1, 0.75, 1.1, MAT.crate, x, platform.height + 0.4, z, rand(-0.2, 0.2))
    add(c, { collide: true })
    addCover(x + 1.2, z + 0.8)
  }

  // ---------- shipping containers ----------
  const containerMats = [MAT.teal, MAT.rust, MAT.olive, MAT.blue]
  const containers = [
    { x: -19, z: -7, ry: 0, color: 0, stack: 2 },
    { x: 19, z: -12, ry: Math.PI / 2, color: 1, stack: 1 },
    { x: -17, z: 15, ry: Math.PI / 2, color: 2, stack: 2 },
    { x: 21, z: 15, ry: 0, color: 3, stack: 1 },
    { x: 2, z: -22, ry: Math.PI / 2, color: 1, stack: 1 },
    { x: -27, z: 27, ry: 0.3, color: 3, stack: 1 },
    { x: 25, z: 26, ry: -0.2, color: 0, stack: 2 },
    { x: 12, z: 27, ry: Math.PI / 2, color: 2, stack: 1 },
  ]
  for (const c of containers) {
    for (let stack = 0; stack < c.stack; stack++) {
      const g = new THREE.Group()
      const body = box(6.2, 2.62, 2.5, containerMats[c.color], 0, 1.31, 0)
      g.add(body)
      // door lines
      for (const side of [-1, 1]) {
        const door = box(0.08, 2.4, 2.3, MAT.metalDark, side * 3.12, 1.31, 0)
        g.add(door)
        for (let i = 0; i < 4; i++) {
          const rod = cyl(0.035, 0.035, 2.25, MAT.metalLight, side * 3.18, 1.3, -0.85 + i * 0.58, 6)
          rod.rotation.x = Math.PI / 2
          g.add(rod)
        }
      }
      // stencil
      const stencil = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.9), new THREE.MeshBasicMaterial({ map: signTexture(['KILO-7'], { fg: 'rgba(228,235,232,.62)', bg: 'rgba(0,0,0,0)', border: false, sub: 'CARGO / 04', width: 512, height: 160 }), transparent: true, depthWrite: false, opacity: 0.8 }))
      stencil.position.set(0, 1.5, 1.26)
      g.add(stencil)
      g.position.set(c.x, stack * 2.68, c.z)
      g.rotation.y = c.ry
      add(g, { collide: stack === 0, ray: true })
      // cover points around container
      if (stack === 0) {
        const cos = Math.cos(c.ry), sin = Math.sin(c.ry)
        for (const [ox, oz] of [[4.1, 0], [-4.1, 0], [0, 2.1], [0, -2.1]]) {
          const wx = c.x + ox * cos + oz * sin
          const wz = c.z - ox * sin + oz * cos
          if (Math.abs(wx) < 33 && Math.abs(wz) < 33) addCover(wx, wz)
        }
      }
    }
  }

  // ---------- jersey barriers ----------
  const barrierShape = new THREE.Shape()
  barrierShape.moveTo(-0.36, 0); barrierShape.lineTo(0.36, 0); barrierShape.lineTo(0.3, 0.26)
  barrierShape.lineTo(0.17, 0.9); barrierShape.lineTo(0.12, 1.04); barrierShape.lineTo(-0.12, 1.04)
  barrierShape.lineTo(-0.17, 0.9); barrierShape.lineTo(-0.3, 0.26); barrierShape.closePath()
  const barrierGeo = new THREE.ExtrudeGeometry(barrierShape, { depth: 3.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  barrierGeo.translate(0, 0, -1.55)
  const barrierPositions = [
    [-9, 12, 0.1], [9, 12, -0.15], [-13, 4, 1.57], [13, 4, 1.57],
    [-10, -14, 0], [10, -14, 0.1], [-23, -17, 1.57], [24, -22, 0.3],
    [-25, 8, 1.57], [27, 7, 1.57], [-5, 22, 0.05], [5, 23, -0.02],
  ]
  for (const [x, z, ry] of barrierPositions) {
    const b = new THREE.Mesh(barrierGeo, MAT.concrete)
    b.position.set(x, 0, z); b.rotation.y = ry
    add(b, { collide: true })
    addCover(x + Math.cos(ry) * 2.2, z - Math.sin(ry) * 2.2)
  }

  // ---------- sandbag walls ----------
  const bagGeo = new THREE.CapsuleGeometry(0.17, 0.38, 3, 6)
  const bagPositions = []
  function sandbagWall(x, z, ry, length = 4.2, rows = 3) {
    const group = new THREE.Group()
    const count = Math.round(length / 0.44)
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 0.45 + (row % 2 ? 0.12 : 0)
        bagPositions.push({ x: Math.cos(ry) * off, z: -Math.sin(ry) * off, y: 0.17 + row * 0.28, ry: rand(-0.12, 0.12) })
      }
    }
    const inst = new THREE.InstancedMesh(bagGeo, MAT.sandbag, bagPositions.length)
    inst.castShadow = inst.receiveShadow = true
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1)
    bagPositions.forEach((b, i) => {
      e.set(Math.PI / 2, b.ry, 0, 'YXZ'); q.setFromEuler(e)
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, s)
      inst.setMatrixAt(i, m)
    })
    inst.instanceMatrix.needsUpdate = true
    group.add(inst)
    const col = box(0.55, rows * 0.28 + 0.1, length, MAT.sandbag, 0, (rows * 0.28) / 2, 0)
    col.visible = false
    group.add(col)
    group.position.set(x, 0, z); group.rotation.y = ry
    add(group, { collide: true, ray: true })
    addCover(x + Math.cos(ry) * 1.1, z - Math.sin(ry) * 1.1)
    bagPositions.length = 0
  }
  sandbagWall(-8, 6, 0, 3.4, 3)
  sandbagWall(8, -6, 0, 3.8, 3)
  sandbagWall(-24, -3, Math.PI / 2, 3.6, 2)
  sandbagWall(28, 20, Math.PI / 2, 3.2, 2)
  sandbagWall(-6, -27, 0, 3.6, 3)

  // ---------- crates / barrels / tires / pipes ----------
  const crateSpots = [
    [-13, -10, 1.4], [-11.4, -10, 0.9], [-13.6, -12.2, 1.1], [12, -25, 1.5],
    [13.8, -24.6, 1.0], [24, 3, 1.2], [25.5, 3.6, 0.8], [-27, 18, 1.4],
    [-29, 17, 0.9], [8, 19, 1.1], [9.4, 19.4, 0.7], [-3, 27, 1.3],
  ]
  for (const [x, z, s] of crateSpots) {
    const c = box(s, s, s, MAT.crate, x, s / 2, z, rand(-0.3, 0.3))
    add(c, { collide: true })
    if (Math.random() > 0.55) {
      const c2 = box(s * 0.8, s * 0.75, s * 0.8, MAT.crate, x + rand(-0.4, 0.4), s + s * 0.38, z + rand(-0.4, 0.4), rand(-0.2, 0.2))
      add(c2, { collide: false })
    }
    addCover(x + 1.3, z + 1.1)
  }

  const barrelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14)
  const barrelMat = new THREE.MeshStandardMaterial({ map: tex.metalRust.map, normalMap: tex.metalRust.normalMap, roughness: 0.88, metalness: 0.55, color: 0x9c7d61 })
  const barrelSpots = []
  const barrelGroups = [[-22, -24, 6], [17, 24, 5], [29, 14, 4], [-30, 11, 5], [6, 12, 3], [-15, -20, 4]]
  for (const [gx, gz, n] of barrelGroups) {
    for (let i = 0; i < n; i++) {
      const x = gx + rand(-1.4, 1.4), z = gz + rand(-1.4, 1.4)
      const b = new THREE.Mesh(barrelGeo, barrelMat)
      b.position.set(x, 0.475, z)
      b.rotation.y = rand(0, 6)
      add(b, { ray: true, cast: true })
      barrelSpots.push(new THREE.Vector3(x, 0.5, z))
      if (i === 0) addCover(x + 1, z + 1)
    }
    const col = box(3.4, 1, 3.4, MAT.rubber, gx, 0.5, gz)
    col.visible = false
    add(col, { collide: true, ray: false, cast: false })
  }
  for (const b of barrelSpots) {
    if (Math.random() > 0.6) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 5, 14), MAT.metalDark)
      ring.rotation.x = Math.PI / 2; ring.position.set(b.x, b.y + 0.2, b.z)
      add(ring, { ray: false, cast: false })
    }
  }

  const tireGeo = new THREE.TorusGeometry(0.42, 0.16, 8, 18)
  for (const [x, z, n] of [[-20, 22, 4], [30, -5, 3], [-31, -14, 5], [16, -3, 3]]) {
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(tireGeo, MAT.rubber)
      t.rotation.x = Math.PI / 2
      t.position.set(x + rand(-0.15, 0.15), 0.17 + i * 0.24, z + rand(-0.15, 0.15))
      t.rotation.z = rand(0, 6)
      add(t, { ray: true, cast: true })
    }
  }

  // pipes along south / east walls
  const pipeMat = new THREE.MeshStandardMaterial({ map: tex.metalDark.map, normalMap: tex.metalDark.normalMap, roughness: 0.42, metalness: 0.88, color: 0x8a9597 })
  for (const [x, z, len, axis] of [[0, 34.8, 40, 'x'], [34.8, -8, 30, 'z'], [-34.8, 12, 26, 'z']]) {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16 + i * 0.03, 0.16 + i * 0.03, len, 10), pipeMat)
      if (axis === 'x') { p.rotation.z = Math.PI / 2; p.position.set(x, 2.3 + i * 0.55, z - i * 0.28) }
      else { p.rotation.x = Math.PI / 2; p.position.set(x + i * 0.26, 2.6 + i * 0.5, z) }
      add(p, { ray: true, cast: true })
    }
    // brackets
    for (let i = -1; i <= 1; i++) {
      const bx = axis === 'x' ? i * len / 3 : x
      const bz = axis === 'x' ? z : z + i * len / 3
      add(box(axis === 'x' ? 0.18 : 0.9, 0.18, axis === 'x' ? 0.9 : 0.18, MAT.metalDark, bx, 3.05, bz), { ray: false, cast: false })
    }
  }

  // chainlink fence segment west side
  for (const [x, z, ry, w] of [[-30, -26, 0, 9], [-30, -17, 0, 9]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.5), MAT.fence)
    panel.position.set(x, 1.25, z); panel.rotation.y = ry
    add(panel, { ray: false, cast: false })
    const col = box(w, 2.5, 0.15, MAT.rubber, x, 1.25, z)
    col.visible = false
    add(col, { collide: true, ray: false, cast: false })
    for (const side of [-1, 1]) add(cyl(0.07, 0.07, 2.7, MAT.metalDark, x + side * w / 2, 1.35, z, 8), { ray: false })
  }

  // concrete rubble piles
  const rubbleGeo = new THREE.DodecahedronGeometry(0.4, 0)
  for (const [x, z] of [[-5, -29], [29, -29], [-31, 4], [14, 30], [-14, 27]]) {
    for (let i = 0; i < 11; i++) {
      const r = new THREE.Mesh(rubbleGeo, Math.random() > 0.5 ? MAT.concreteDark : MAT.concrete)
      r.position.set(x + rand(-1.8, 1.8), rand(0.1, 0.4), z + rand(-1.8, 1.8))
      r.scale.setScalar(rand(0.4, 1.5)); r.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6))
      add(r, { ray: true, cast: true })
    }
  }

  // cable spools
  const spoolMat = new THREE.MeshStandardMaterial({ color: 0x3c3630, roughness: 0.9 })
  for (const [x, z] of [[-16, 26], [30, 27]]) {
    const g = new THREE.Group()
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.25, 18), spoolMat)
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.35, 18), new THREE.MeshStandardMaterial({ color: 0x1b1e1c, roughness: 0.7, metalness: 0.5 }))
    g.add(outer, inner); g.rotation.z = Math.PI / 2
    g.position.set(x, 0.9, z)
    add(g, { collide: true })
    addCover(x + 1.2, z)
  }

  // ---------- floodlight towers ----------
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.032, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 })
  const floodPositions = [
    { x: -28, z: -28, tx: -6, tz: -2, color: 0xffd6a0, intensity: 380 },
    { x: 28, z: -27, tx: 4, tz: 4, color: 0xffc98d, intensity: 280 },
    { x: -27, z: 27, tx: -2, tz: 0, color: 0xffd6a0, intensity: 300 },
    { x: 29, z: 26, tx: 6, tz: -3, color: 0xffc98d, intensity: 220 },
  ]
  for (const f of floodPositions) {
    const g = new THREE.Group()
    const pole = cyl(0.14, 0.2, 12, MAT.metalDark, 0, 6, 0, 8)
    g.add(pole)
    for (let i = 0; i < 3; i++) {
      const arm = box(2.6 - i * 0.5, 0.08, 0.08, MAT.metalDark, 0, 10.8 + i * 0.3, 0)
      g.add(arm)
    }
    for (let i = 0; i < 3; i++) {
      const lamp = box(0.55, 0.3, 0.8, lampMat, -0.9 + i * 0.9, 11.5, 0)
      g.add(lamp)
    }
    g.position.set(f.x, 0, f.z)
    add(g, { collide: true, ray: true })
    const dx = f.tx - f.x, dz = f.tz - f.z
    const dist = Math.hypot(dx, dz)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 20, 1, true), coneMat)
    cone.position.set(f.x, 11.3 - 8, f.z)
    // orient cone -Y toward target
    const dir = new THREE.Vector3(dx, -10.8, dz).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    cone.quaternion.copy(q)
    cone.position.set(f.x + dx * 0.25, 6.3, f.z + dz * 0.25)
    scene.add(cone)
    const spot = new THREE.SpotLight(f.color, f.intensity, 48, 0.42, 0.75, 1.1)
    spot.position.set(f.x, 11.3, f.z)
    spot.target.position.set(f.tx, 0, f.tz)
    scene.add(spot, spot.target)
    flickerLights.push({ spot, cone, base: f.intensity, phase: rand(0, 20), rate: rand(0.6, 1.3) })
    const flair = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('flare'), color: 0xffd8a0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }))
    flair.scale.set(12, 12, 1)
    flair.position.set(f.x, 11.3, f.z)
    scene.add(flair)
    addCover(f.x + 1.6, f.z + 1.2)
  }

  // searchlight tower (rotating)
  const searchTower = new THREE.Group()
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = box(0.22, 13, 0.22, MAT.metalDark, sx * 1.4, 6.5, sz * 1.4)
    searchTower.add(leg)
  }
  for (let i = 0; i < 3; i++) {
    const ring = box(3, 0.16, 3, MAT.metalDark, 0, 3 + i * 4, 0)
    searchTower.add(ring)
  }
  const cabin = box(3.6, 2.2, 3.6, MAT.metalDark, 0, 12.2, 0)
  searchTower.add(cabin)
  const roof = box(4.2, 0.16, 4.2, MAT.metalLight, 0, 13.4, 0)
  searchTower.add(roof)
  searchTower.position.set(-30, 0, -30)
  searchTower.rotation.y = 0.4
  add(searchTower, { collide: true })
  const searchSpot = new THREE.SpotLight(0xcfe6ff, 900, 100, 0.055, 0.35, 1.1)
  searchSpot.position.set(-30, 13.2, -30)
  const searchTarget = new THREE.Object3D()
  searchTarget.position.set(0, 0, 0)
  scene.add(searchSpot, searchTarget)
  searchSpot.target = searchTarget
  const searchCone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 48, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xa8c8ee, transparent: true, opacity: 0.028, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
  scene.add(searchCone)
  const searchGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('glow'), color: 0x9fc4f0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
  searchGlow.scale.set(3.2, 3.2, 1)
  searchGlow.position.set(-30, 13.4, -30)
  scene.add(searchGlow)
  const searchLight = { spot: searchSpot, cone: searchCone, target: searchTarget, angle: 0 }
  animated.push({ type: 'search', obj: searchLight })

  // ---------- watchtowers / antenna ----------
  function watchtower(x, z) {
    const g = new THREE.Group()
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.add(box(0.24, 9.5, 0.24, MAT.metalDark, sx * 1.6, 4.75, sz * 1.6))
      const brace1 = box(0.14, 0.14, 3.7, MAT.metalDark, sx * 1.6, 3, 0); brace1.rotation.x = 0.74; g.add(brace1)
    }
    g.add(box(4.2, 0.2, 4.2, MAT.metalDark, 0, 9.2, 0))
    g.add(box(3.6, 0.9, 3.6, MAT.metalDark, 0, 9.8, 0))
    g.add(box(4.6, 0.15, 4.6, MAT.metalLight, 0, 10.5, 0))
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a16 }))
    lamp.position.set(0, 10.8, 0)
    g.add(lamp)
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3a20, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
    beam.position.y = 7.6; beam.rotation.x = Math.PI
    g.add(beam)
    g.position.set(x, 0, z)
    if (Math.abs(x) < 40) add(g, { collide: true, ray: true })
    else scene.add(g)
    beacons.push({ lamp, glow: null, phase: rand(0, 6) })
    return g
  }
  watchtower(-33, -33); watchtower(33, -33); watchtower(-33, 33); watchtower(33, 33)

  // antenna mast
  const mast = new THREE.Group()
  mast.add(cyl(0.09, 0.16, 24, MAT.metalDark, 0, 12, 0, 8))
  for (let i = 0; i < 5; i++) {
    const r = 1.4 - i * 0.22
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 4, 12), MAT.metalDark)
    ring.rotation.x = Math.PI / 2; ring.position.y = 6 + i * 4
    mast.add(ring)
  }
  for (let i = 0; i < 4; i++) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a16 }))
    beacon.position.set(Math.cos(i / 4 * 6.28) * 0.8, 12 + i * 3, Math.sin(i / 4 * 6.28) * 0.8)
    mast.add(beacon)
  }
  mast.position.set(30, 0, -32)
  add(mast, { collide: true })
  // guy wires
  const wireGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(30, 22, -32), new THREE.Vector3(21, 0, -24),
    new THREE.Vector3(30, 18, -32), new THREE.Vector3(38, 0, -24),
    new THREE.Vector3(30, 14, -32), new THREE.Vector3(22, 0, -40),
  ])
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x556468, transparent: true, opacity: 0.4 })))

  // ---------- outer world silhouette ----------
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: 0.95, metalness: 0.05 })
  const winMat = new THREE.MeshBasicMaterial({ map: tex.windows, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  const citySpots = [
    [-52, -55, 14, 24, 12], [-20, -62, 22, 16, 16], [22, -58, 18, 30, 14],
    [58, -40, 16, 20, 18], [62, 18, 22, 18, 14], [46, 58, 18, 26, 16],
    [8, 62, 26, 20, 12], [-36, 60, 18, 30, 14], [-62, 28, 20, 22, 18], [-58, -22, 14, 18, 10],
  ]
  for (const [x, z, w, h, d] of citySpots) {
    const b = box(w, h, d, cityMat, x, h / 2, z)
    scene.add(b)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, h * 0.7), winMat)
    win.position.set(x, h / 2, z + (z > 0 ? -d / 2 - 0.05 : d / 2 + 0.05))
    if (z > 0) win.rotation.y = Math.PI
    scene.add(win)
  }
  // distant smoke stacks
  for (const [x, z] of [[-55, -35], [48, 42]]) {
    const stack = cyl(1.4, 2.1, 34, MAT.concreteDark, x, 17, z, 12)
    scene.add(stack)
  }

  // smoke plumes
  const smokeTex = spriteTexture('smoke')
  const smokeSprites = []
  for (const [sx, sz, n] of [[-55, -35, 12], [48, 42, 10]]) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x2c3238, transparent: true, opacity: 0.05, depthWrite: false }))
      s.position.set(sx + rand(-2, 2), 33 + i * 2.4, sz + rand(-2, 2))
      s.scale.setScalar(5 + i * 1.1)
      scene.add(s)
      smokeSprites.push({ sprite: s, baseX: s.position.x, baseZ: s.position.z, phase: rand(0, 6), speed: rand(0.06, 0.14) })
    }
  }

  // ground fog banks
  const fogSprites = []
  for (let i = 0; i < 15; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x263543, transparent: true, opacity: 0.035, depthWrite: false }))
    s.position.set(rand(-34, 34), rand(0.4, 1.8), rand(-34, 34))
    s.scale.set(rand(9, 16), rand(4, 7), 1)
    scene.add(s)
    fogSprites.push({ sprite: s, phase: rand(0, 6), speed: rand(0.03, 0.09) })
  }

  // hanging cable silhouettes between poles
  const cableMat = new THREE.LineBasicMaterial({ color: 0x121a1e, transparent: true, opacity: 0.8 })
  for (const [x1, z1, x2, z2, y] of [[-34, -8, -34, 22, 9], [34, -20, 34, 14, 8], [-20, 34.5, 18, 34.5, 7.5]]) {
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const sag = Math.sin(t * Math.PI) * 1.8
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - sag, z1 + (z2 - z1) * t))
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat))
  }

  // ---------- rain ----------
  const rainCount = 2600
  const rainGeo = new THREE.BufferGeometry()
  const rainPos = new Float32Array(rainCount * 2 * 3)
  const rainSeed = new Float32Array(rainCount * 2)
  const rainEnd = new Float32Array(rainCount * 2)
  for (let i = 0; i < rainCount; i++) {
    const x = rand(-22, 22), y = rand(0, 22), z = rand(-22, 22), seed = Math.random()
    for (let j = 0; j < 2; j++) {
      const idx = (i * 2 + j) * 3
      rainPos[idx] = x; rainPos[idx + 1] = y; rainPos[idx + 2] = z
      rainSeed[i * 2 + j] = seed
      rainEnd[i * 2 + j] = j
    }
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  rainGeo.setAttribute('seed', new THREE.BufferAttribute(rainSeed, 1))
  rainGeo.setAttribute('end', new THREE.BufferAttribute(rainEnd, 1))
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, playerPos: { value: new THREE.Vector3() }, opacity: { value: 0.34 } },
    vertexShader: `
      attribute float seed; attribute float end; uniform float time; uniform vec3 playerPos; varying float vA;
      void main(){
        vec3 p = position;
        vec2 rel = mod(p.xz - playerPos.xz + 22.0, 44.0) - 22.0;
        float speed = 14.0 + seed * 9.0;
        float y = mod(p.y - time * speed, 22.0);
        p.x = playerPos.x + rel.x + time * 0.8;
        p.z = playerPos.z + rel.y + time * 1.6;
        p.y = y;
        if (end > 0.5) { p.y -= 0.55; p.x -= 0.03; p.z -= 0.06; }
        vA = 0.15 + seed * 0.35;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `varying float vA; uniform float opacity; void main(){ gl_FragColor = vec4(0.55,0.68,0.8, vA * opacity); }`,
  })
  const rain = new THREE.LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  scene.add(rain)

  // floating embers / dust
  const dustCount = 230
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  const dustSeed = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = rand(-34, 34); dustPos[i * 3 + 1] = rand(0.2, 12); dustPos[i * 3 + 2] = rand(-34, 34)
    dustSeed[i] = Math.random()
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1))
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, map: { value: spriteTexture('glow') }, opacity: { value: 0.35 } },
    vertexShader: `attribute float seed; uniform float time; varying float vA; void main(){ vec3 p=position; p.y += sin(time*0.3+seed*20.0)*0.5; p.x += sin(time*0.11+seed*30.0)*0.7; p.z += cos(time*0.09+seed*20.0)*0.7; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(2.0+seed*4.0)*(90.0/-mv.z); gl_Position=projectionMatrix*mv; vA=0.2+seed*0.6; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; uniform float opacity; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(0.65,0.73,0.8,t.a*vA*opacity); }`,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  scene.add(dust)

  // ---------- spawn / cover / player ----------
  const playerSpawn = new THREE.Vector3(0, 0, 20)
  enemySpawnPoints.push(
    new THREE.Vector3(0, 0, -31), new THREE.Vector3(0, 0, 31), new THREE.Vector3(-31, 0, 0), new THREE.Vector3(31, 0, 0),
    new THREE.Vector3(-27, 0, -27), new THREE.Vector3(27, 0, 27), new THREE.Vector3(-27, 0, 27), new THREE.Vector3(27, 0, -27),
    new THREE.Vector3(-12, 0, -30), new THREE.Vector3(14, 0, 30)
  )
  // spawn flare markers (subtle red ground glow)
  for (const sp of enemySpawnPoints) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.4, 24), new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(sp.x, 0.02, sp.z)
    scene.add(ring)
  }

  // ---------- static minimap ----------
  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = mapCanvas.height = 400
  const mctx = mapCanvas.getContext('2d')
  const mapScale = 400 / 80
  const toMap = (v) => (v + 40) * mapScale
  mctx.fillStyle = '#071015'; mctx.fillRect(0, 0, 400, 400)
  mctx.strokeStyle = 'rgba(120,190,210,.08)'; mctx.lineWidth = 1
  for (let i = 0; i <= 400; i += 20) { mctx.beginPath(); mctx.moveTo(i, 0); mctx.lineTo(i, 400); mctx.stroke(); mctx.beginPath(); mctx.moveTo(0, i); mctx.lineTo(400, i); mctx.stroke() }
  // colliders as blocks
  for (const c of colliders) {
    mctx.fillStyle = 'rgba(130,160,170,.24)'
    mctx.strokeStyle = 'rgba(160,200,215,.28)'
    mctx.fillRect(toMap(c.minX), toMap(c.minZ), (c.maxX - c.minX) * mapScale, (c.maxZ - c.minZ) * mapScale)
    mctx.strokeRect(toMap(c.minX), toMap(c.minZ), (c.maxX - c.minX) * mapScale, (c.maxZ - c.minZ) * mapScale)
  }
  mctx.fillStyle = 'rgba(255,180,87,.35)'; mctx.strokeStyle = 'rgba(255,190,100,.7)'
  mctx.fillRect(toMap(platform.minX), toMap(platform.minZ), (platform.maxX - platform.minX) * mapScale, (platform.maxZ - platform.minZ) * mapScale)
  mctx.strokeRect(toMap(platform.minX), toMap(platform.minZ), (platform.maxX - platform.minX) * mapScale, (platform.maxZ - platform.minZ) * mapScale)
  mctx.strokeStyle = 'rgba(130,230,255,.25)'; mctx.lineWidth = 2; mctx.strokeRect(6, 6, 388, 388)

  // ---------- update ----------
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, -1, 0)
  function update(dt, time, playerPos) {
    skyMat.uniforms.time.value = time
    rainMat.uniforms.time.value = time
    rainMat.uniforms.playerPos.value.copy(playerPos)
    dustMat.uniforms.time.value = time

    if (playerPos) {
      // searchlight sweeps
      const a = time * 0.17
      searchTarget.position.set(Math.cos(a) * 16, 0, Math.sin(a * 0.8 + 1) * 15)
      const dir = tmpV.copy(searchTarget.position).sub(searchSpot.position)
      const len = dir.length()
      dir.normalize()
      searchCone.position.copy(searchSpot.position).addScaledVector(dir, len / 2)
      tmpQ.setFromUnitVectors(up, dir)
      searchCone.quaternion.copy(tmpQ)
      searchCone.scale.set(1, len / 48, 1)
    }

    for (const b of beacons) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.2 + b.phase)
      if (b.lamp?.material) b.lamp.material.color.setRGB(1, 0.1 + pulse * 0.25, 0.06)
      if (b.lamp2?.material) b.lamp2.material.color.setRGB(1, 0.1 + pulse * 0.25, 0.06)
      if (b.glow) b.glow.material.opacity = 0.2 + pulse * 0.45
    }
    for (const f of flickerLights) {
      const flick = 0.88 + 0.12 * Math.sin(time * 17 * f.rate + f.phase) * Math.sin(time * 5.3 + f.phase * 2)
      f.spot.intensity = f.base * flick
      f.cone.material.opacity = 0.026 * flick
    }
    for (const s of smokeSprites) {
      s.sprite.position.y += dt * s.speed
      s.sprite.position.x = s.baseX + Math.sin(time * 0.12 + s.phase) * 3
      s.sprite.position.z = s.baseZ + Math.cos(time * 0.1 + s.phase) * 3
      if (s.sprite.position.y > 60) s.sprite.position.y = 32
    }
    for (const f of fogSprites) {
      f.sprite.position.x += Math.sin(time * 0.04 + f.phase) * dt * f.speed
      f.sprite.position.z += Math.cos(time * 0.03 + f.phase) * dt * f.speed
    }
  }

  function groundHeightAt(x, z) {
    if (x > platform.minX && x < platform.maxX && z > platform.minZ && z < platform.maxZ) return platform.height
    for (const r of platform.ramps) {
      if (Math.abs(x - r.x) < r.w / 2 && z >= Math.min(r.z0, r.z1) && z <= Math.max(r.z0, r.z1)) {
        const t = (z - r.z0) / (r.z1 - r.z0)
        return platform.height * (1 - t)
      }
    }
    return 0
  }

  function colliderAt(x, z, radius, feetY, height) {
    for (const c of colliders) {
      if (feetY + height <= c.minY + 0.05 || feetY >= c.maxY - 0.02) continue
      const cx = Math.max(c.minX, Math.min(x, c.maxX))
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ))
      const dx = x - cx, dz = z - cz
      if (dx * dx + dz * dz < radius * radius) return c
    }
    return null
  }

  function boundsClamp(pos, radius) {
    pos.x = Math.max(ARENA.minX + radius, Math.min(ARENA.maxX - radius, pos.x))
    pos.z = Math.max(ARENA.minZ + radius, Math.min(ARENA.maxZ - radius, pos.z))
  }

  return {
    scene, sky, environment, moonLight, hemi, MAT, tex, colliders, raycastTargets, coverPoints,
    enemySpawnPoints, playerSpawn, platform, groundHeightAt, colliderAt, boundsClamp, update,
    staticMap: mapCanvas, mapScale, toMap,
  }
}
