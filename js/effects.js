import * as THREE from 'three'
import { decalTexture, spriteTexture } from './textures.js'

function rand(a = 0, b = 1) { return a + Math.random() * (b - a) }

class ParticleSystem {
  constructor(scene, max, { additive = false, map = 'glow', gravity = 9.8 } = {}) {
    this.max = max
    this.gravity = gravity
    this.particles = []
    this.positions = new Float32Array(max * 3)
    this.colors = new Float32Array(max * 3)
    this.sizes = new Float32Array(max)
    this.alphas = new Float32Array(max)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))
    geo.setDrawRange(0, 0)
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: spriteTexture(map) }, opacity: { value: 1 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (420.0 / max(0.4, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D map; uniform float opacity; varying vec3 vColor; varying float vAlpha;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          if (t.a < 0.01) discard;
          gl_FragColor = vec4(vColor, t.a * vAlpha * opacity);
        }
      `,
    })
    this.mesh = new THREE.Points(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
    scene.add(this.mesh)
    this.geo = geo
  }

  spawn({ pos, vel, color = [1, 1, 1], size = 0.15, life = 0.6, gravity = this.gravity, drag = 0.9, grow = 0, alpha = 1 }) {
    if (this.particles.length >= this.max) this.particles.shift()
    this.particles.push({
      pos: pos.clone(), vel: vel.clone(), color, size, life, maxLife: life,
      gravity, drag, grow, alpha,
    })
  }

  update(dt) {
    const ps = this.particles
    let n = 0
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) { ps.splice(i, 1); continue }
      p.vel.y -= p.gravity * dt
      const d = Math.pow(p.drag, dt * 60)
      p.vel.x *= d; p.vel.z *= d; p.vel.y *= d
      p.pos.addScaledVector(p.vel, dt)
      if (p.pos.y < 0.02 && p.gravity > 0) { p.pos.y = 0.02; p.vel.y *= -0.25; p.vel.x *= 0.55; p.vel.z *= 0.55 }
      p.size += p.grow * dt
    }
    for (let i = 0; i < ps.length && n < this.max; i++) {
      const p = ps[i]
      const t = p.life / p.maxLife
      this.positions[n * 3] = p.pos.x
      this.positions[n * 3 + 1] = p.pos.y
      this.positions[n * 3 + 2] = p.pos.z
      this.colors[n * 3] = p.color[0]
      this.colors[n * 3 + 1] = p.color[1]
      this.colors[n * 3 + 2] = p.color[2]
      this.sizes[n] = p.size
      this.alphas[n] = p.alpha * Math.min(1, t * 2.2) * Math.min(1, p.life * 8)
      n++
    }
    this.geo.setDrawRange(0, n)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.attributes.size.needsUpdate = true
    this.geo.attributes.alpha.needsUpdate = true
  }
}

export class Effects {
  constructor(scene, world, camera) {
    this.scene = scene
    this.world = world
    this.camera = camera
    this.time = 0
    this.sparks = new ParticleSystem(scene, 700, { additive: true, map: 'spark', gravity: 9.8 })
    this.smoke = new ParticleSystem(scene, 500, { additive: false, map: 'smoke', gravity: -0.35 })
    this.fire = new ParticleSystem(scene, 260, { additive: true, map: 'flash', gravity: -1.5 })
    this.tracers = []
    for (let i = 0; i < 38; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 1, 5, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      )
      m.visible = false
      m.frustumCulled = false
      scene.add(m)
      this.tracers.push({ mesh: m, life: 0, maxLife: 0.07 })
    }
    this.tracerIndex = 0
    this.flashLight = new THREE.PointLight(0xffb060, 0, 22, 2)
    this.flashLight.position.set(0, 2, 0)
    scene.add(this.flashLight)
    this.flashIntensity = 0
    this.flashPos = new THREE.Vector3()

    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('flash'), color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.muzzle.scale.set(1, 1, 1)
    scene.add(this.muzzle)
    this.muzzleLife = 0

    this.decals = []
    this.decalGeo = new THREE.PlaneGeometry(0.25, 0.25)
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ map: decalTexture('bullet'), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
      m.visible = false
      scene.add(m)
      this.decals.push({ mesh: m, life: 0 })
    }
    this.decalIndex = 0
    this.scorches = []
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ map: decalTexture('scorch'), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
      m.rotation.x = -Math.PI / 2
      m.visible = false
      scene.add(m)
      this.scorches.push({ mesh: m, life: 0 })
    }
    this.scorchIndex = 0

    this.rings = []
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
      m.rotation.x = -Math.PI / 2
      m.visible = false
      scene.add(m)
      this.rings.push({ mesh: m, life: 0, max: 0, size: 1 })
    }
    this.ringIndex = 0

    this.casings = []
    const casingGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.032, 5)
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xb08b42, metalness: 0.9, roughness: 0.3, emissive: 0x1a1004 })
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(casingGeo, casingMat)
      m.visible = false
      m.castShadow = false
      scene.add(m)
      this.casings.push({ mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 })
    }
    this.casingIndex = 0
    this.shake = 0
    this.onShake = null
  }

  tracer(from, to, color = 0xffd8a0, opacity = 0.85) {
    const t = this.tracers[this.tracerIndex++ % this.tracers.length]
    const dir = to.clone().sub(from)
    const len = dir.length()
    if (len < 0.1) return
    const m = t.mesh
    m.visible = true
    m.position.copy(from).addScaledVector(dir, 0.5)
    m.scale.set(1, len, 1)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    m.material.color.setHex(color)
    m.material.opacity = opacity
    t.life = t.maxLife
  }

  muzzleFlash(pos, dir, scale = 1) {
    this.muzzle.position.copy(pos)
    this.muzzle.scale.setScalar(rand(0.55, 0.9) * scale)
    this.muzzle.material.rotation = rand(0, 6.28)
    this.muzzle.material.opacity = 1
    this.muzzleLife = 0.06
    this.flashPos.copy(pos)
    this.flashLight.position.copy(pos)
    this.flashIntensity = 16 * scale
    for (let i = 0; i < 3; i++) {
      this.smoke.spawn({
        pos: pos.clone().addScaledVector(dir, rand(0.05, 0.25)),
        vel: dir.clone().multiplyScalar(rand(0.5, 1.6)).add(new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2))),
        color: [0.42, 0.42, 0.42], size: rand(0.2, 0.4), life: rand(0.5, 1.1), gravity: -0.2, drag: 0.94, grow: 0.6, alpha: 0.32,
      })
    }
    for (let i = 0; i < 2; i++) {
      this.sparks.spawn({
        pos: pos.clone(), vel: dir.clone().multiplyScalar(rand(2, 6)).add(new THREE.Vector3(rand(-0.8, 0.8), rand(-0.5, 0.5), rand(-0.8, 0.8))),
        color: [1, 0.7, 0.32], size: rand(0.04, 0.08), life: rand(0.08, 0.2), gravity: 4, drag: 0.9,
      })
    }
  }

  impact(point, normal, { metal = false, force = 1 } = {}) {
    const n = normal.clone().normalize()
    const count = Math.round(rand(5, 10) * force)
    for (let i = 0; i < count; i++) {
      const v = n.clone().multiplyScalar(rand(1.2, 4.5)).add(new THREE.Vector3(rand(-1.9, 1.9), rand(-0.8, 2.2), rand(-1.9, 1.9)))
      this.sparks.spawn({
        pos: point.clone().addScaledVector(n, 0.03), vel: v,
        color: metal ? [1, 0.8, 0.45] : [1, 0.62, 0.25], size: rand(0.025, 0.07), life: rand(0.12, 0.42), gravity: 8, drag: 0.9,
      })
    }
    for (let i = 0; i < 2; i++) {
      this.smoke.spawn({
        pos: point.clone().addScaledVector(n, 0.05),
        vel: n.clone().multiplyScalar(rand(0.15, 0.6)).add(new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.4), rand(-0.2, 0.2))),
        color: [0.32, 0.31, 0.29], size: rand(0.15, 0.32), life: rand(0.5, 1.2), gravity: -0.1, drag: 0.93, grow: 0.35, alpha: 0.35,
      })
    }
    this.addDecal(point, n, 0.22)
  }

  addDecal(point, normal, size = 0.22) {
    const d = this.decals[this.decalIndex++ % this.decals.length]
    const m = d.mesh
    m.visible = true
    m.position.copy(point).addScaledVector(normal, 0.012)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    m.rotateZ(rand(0, 6.28))
    m.scale.setScalar(size / 0.25 * rand(0.8, 1.25))
    m.material.opacity = 0.9
    d.life = 22
  }

  blood(point, dir, amount = 1) {
    const n = Math.round(rand(8, 14) * amount)
    for (let i = 0; i < n; i++) {
      this.sparks.spawn({
        pos: point.clone(), vel: dir.clone().multiplyScalar(rand(0.5, 2.2)).add(new THREE.Vector3(rand(-1.4, 1.4), rand(0, 2.4), rand(-1.4, 1.4))),
        color: [0.55, 0.04, 0.03], size: rand(0.03, 0.09), life: rand(0.2, 0.6), gravity: 7, drag: 0.9,
      })
    }
    for (let i = 0; i < 2; i++) {
      this.smoke.spawn({
        pos: point.clone(), vel: new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.4), rand(-0.2, 0.2)),
        color: [0.3, 0.03, 0.02], size: rand(0.2, 0.36), life: rand(0.5, 1), gravity: -0.1, drag: 0.92, grow: 0.5, alpha: 0.3,
      })
    }
  }

  explosion(pos, { radius = 4, color = 0xff8a3c } = {}) {
    for (let i = 0; i < 55; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize()
      this.fire.spawn({
        pos: pos.clone().add(new THREE.Vector3(0, rand(0.1, 0.6), 0)),
        vel: dir.multiplyScalar(rand(2, 11)), color: [1, rand(0.35, 0.75), rand(0.1, 0.25)],
        size: rand(0.35, 0.9), life: rand(0.25, 0.8), gravity: -1.5, drag: 0.9, grow: 0.8, alpha: 0.9,
      })
    }
    for (let i = 0; i < 40; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize()
      this.sparks.spawn({
        pos: pos.clone(), vel: dir.multiplyScalar(rand(5, 18)), color: [1, rand(0.65, 0.9), 0.35],
        size: rand(0.03, 0.09), life: rand(0.4, 1.2), gravity: 11, drag: 0.92,
      })
    }
    for (let i = 0; i < 28; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize()
      this.smoke.spawn({
        pos: pos.clone().add(new THREE.Vector3(0, rand(0, 0.8), 0)), vel: dir.multiplyScalar(rand(0.8, 3.2)),
        color: [0.13, 0.12, 0.11], size: rand(0.8, 1.6), life: rand(1.4, 2.8), gravity: -0.5, drag: 0.93, grow: 1.2, alpha: 0.6,
      })
    }
    this.flashLight.position.copy(pos); this.flashLight.position.y += 1
    this.flashIntensity = 90
    const r = this.rings[this.ringIndex++ % this.rings.length]
    r.mesh.visible = true; r.mesh.position.set(pos.x, 0.06, pos.z); r.mesh.scale.setScalar(0.2)
    r.mesh.material.color.setHex(color); r.mesh.material.opacity = 0.75
    r.life = 0.5; r.max = 0.5; r.size = radius
    const sc = this.scorches[this.scorchIndex++ % this.scorches.length]
    sc.mesh.visible = true; sc.mesh.position.set(pos.x, 0.02, pos.z)
    sc.mesh.scale.setScalar(radius / 2.2 * rand(0.9, 1.2))
    sc.mesh.material.opacity = 0.85; sc.life = 30
    this.shake = Math.max(this.shake, 0.45)
    this.onShake?.(0.55, 0.5)
  }

  casing(pos, dir) {
    const c = this.casings[this.casingIndex++ % this.casings.length]
    c.mesh.visible = true
    c.mesh.position.copy(pos)
    c.vel.set(rand(0.6, 1.8), rand(0.8, 2), rand(-0.4, 0.4)).addScaledVector(dir, 0.4)
    c.spin.set(rand(-20, 20), rand(-20, 20), rand(-20, 20))
    c.life = 2.4
  }

  update(dt, time) {
    this.time = time
    this.sparks.update(dt)
    this.smoke.update(dt)
    this.fire.update(dt)
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt
        t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.9
        if (t.life <= 0) t.mesh.visible = false
      }
    }
    for (const d of this.decals) {
      if (d.life > 0) {
        d.life -= dt
        d.mesh.material.opacity = Math.min(0.9, d.life / 2)
        if (d.life <= 0) d.mesh.visible = false
      }
    }
    for (const s of this.scorches) {
      if (s.life > 0) {
        s.life -= dt
        s.mesh.material.opacity = Math.min(0.85, s.life / 6)
        if (s.life <= 0) s.mesh.visible = false
      }
    }
    for (const r of this.rings) {
      if (r.life > 0) {
        r.life -= dt
        const t = 1 - r.life / r.max
        r.mesh.scale.setScalar(0.2 + t * r.size)
        r.mesh.material.opacity = (1 - t) * 0.7
        if (r.life <= 0) r.mesh.visible = false
      }
    }
    for (const c of this.casings) {
      if (c.life > 0) {
        c.life -= dt
        c.vel.y -= 9.8 * dt
        c.mesh.position.addScaledVector(c.vel, dt)
        c.mesh.rotation.x += c.spin.x * dt
        c.mesh.rotation.y += c.spin.y * dt
        c.mesh.rotation.z += c.spin.z * dt
        if (c.mesh.position.y < 0.02) { c.mesh.position.y = 0.02; c.vel.y *= -0.35; c.vel.x *= 0.6; c.vel.z *= 0.6 }
        if (c.life <= 0) c.mesh.visible = false
      }
    }
    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt
      this.muzzle.material.opacity = Math.max(0, this.muzzleLife / 0.06)
    } else {
      this.muzzle.material.opacity = 0
    }
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 260)
      this.flashLight.intensity = this.flashIntensity
    } else {
      this.flashLight.intensity = 0
    }
    this.shake = Math.max(0, this.shake - dt * 1.8)
  }
}
