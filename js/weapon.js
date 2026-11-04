import * as THREE from 'three'
import { spriteTexture } from './textures.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
const rand = (a, b) => a + Math.random() * (b - a)

export const WEAPONS = [
  {
    id: 'rifle', name: 'VK-7 CARBINE', short: 'VK-7', mode: 'AUTO', kind: 'rifle',
    magSize: 30, reserveMax: 240, damage: 31, headMul: 2.35, rpm: 720, auto: true,
    reloadTime: 2.05, spreadHip: 0.017, spreadAds: 0.0022, moveSpread: 0.022,
    recoil: 0.0085, recoilYaw: 0.0035, adsFov: 56, range: 130,
  },
  {
    id: 'pistol', name: 'M9 SIDEARM', short: 'M9', mode: 'SEMI', kind: 'pistol',
    magSize: 15, reserveMax: 120, damage: 44, headMul: 2.5, rpm: 430, auto: false,
    reloadTime: 1.55, spreadHip: 0.012, spreadAds: 0.0018, moveSpread: 0.016,
    recoil: 0.012, recoilYaw: 0.004, adsFov: 60, range: 100,
  },
]

function metal(color, roughness = 0.42, metalness = 0.86) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function buildRifle() {
  const g = new THREE.Group()
  const dark = metal(0x22282a, 0.38, 0.9)
  const black = metal(0x111516, 0.5, 0.72)
  const tan = new THREE.MeshStandardMaterial({ color: 0x8b7454, roughness: 0.78, metalness: 0.08 })
  const tanDark = new THREE.MeshStandardMaterial({ color: 0x5b4c37, roughness: 0.72, metalness: 0.12 })
  const glove = new THREE.MeshStandardMaterial({ color: 0x111413, roughness: 0.85, metalness: 0.02 })
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b3029, roughness: 0.92, metalness: 0.01 })
  const accent = new THREE.MeshStandardMaterial({ color: 0x0a0c0c, emissive: 0x44d9ff, emissiveIntensity: 1.3, roughness: 0.4 })

  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz)
    g.add(m); return m
  }
  function cyl(r, len, mat, x, y, z, axis = 'z', seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat)
    m.position.set(x, y, z)
    if (axis === 'z') m.rotation.x = Math.PI / 2
    if (axis === 'x') m.rotation.z = Math.PI / 2
    g.add(m); return m
  }

  // receiver
  box(0.072, 0.095, 0.32, dark, 0, 0, -0.06)
  box(0.078, 0.055, 0.2, black, 0, -0.055, -0.03)
  box(0.046, 0.012, 0.5, black, 0, 0.052, -0.2)
  // handguard with vents
  box(0.064, 0.068, 0.31, tanDark, 0, 0.005, -0.37)
  for (let i = 0; i < 5; i++) {
    box(0.07, 0.009, 0.02, black, 0, 0.005, -0.27 - i * 0.052)
  }
  // barrel + suppressor
  cyl(0.012, 0.26, black, 0, 0.008, -0.59, 'z', 10)
  cyl(0.029, 0.17, dark, 0, 0.008, -0.79, 'z', 14)
  cyl(0.032, 0.02, black, 0, 0.008, -0.7, 'z', 14)
  // stock
  box(0.05, 0.075, 0.22, tan, 0, -0.004, 0.2)
  box(0.055, 0.09, 0.035, black, 0, -0.004, 0.315)
  box(0.03, 0.025, 0.16, tan, 0, 0.04, 0.2)
  // grip + trigger guard
  box(0.045, 0.14, 0.06, tanDark, 0, -0.115, 0.07, -0.18)
  box(0.012, 0.02, 0.09, black, 0, -0.07, 0.035)
  box(0.012, 0.04, 0.012, black, 0, -0.09, -0.005)
  // magazine
  const mag = box(0.048, 0.16, 0.09, black, 0, -0.15, -0.08, 0.12)
  box(0.052, 0.02, 0.095, dark, 0, -0.235, -0.07, 0.12)
  // optic
  box(0.028, 0.026, 0.1, black, 0, 0.072, -0.03)
  cyl(0.029, 0.105, dark, 0, 0.098, -0.03, 'z', 16)
  const lens1 = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), new THREE.MeshBasicMaterial({ color: 0x2d4a55, transparent: true, opacity: 0.45 }))
  lens1.position.set(0, 0.098, 0.024); g.add(lens1)
  const lens2 = lens1.clone(); lens2.position.z = -0.084; lens2.rotation.y = Math.PI; g.add(lens2)
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('glow'), color: 0xff2a1a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }))
  dot.scale.set(0.012, 0.012, 1)
  dot.position.set(0, 0.098, -0.085)
  g.add(dot)
  // iron sights
  box(0.01, 0.026, 0.01, black, 0, 0.072, -0.52)
  box(0.034, 0.012, 0.012, black, 0, 0.064, -0.52)
  // charging handle / bolt
  box(0.028, 0.018, 0.06, black, 0.04, 0.03, 0.02)
  // small side display
  box(0.004, 0.025, 0.06, accent, -0.039, 0.03, -0.02)
  // rails
  for (let i = 0; i < 5; i++) box(0.012, 0.008, 0.028, black, -0.038, 0.058, -0.1 - i * 0.045)

  // hands and arms
  const rightHand = new THREE.Group()
  rightHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.11), glove))
  rightHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.04), glove))
  rightHand.children[1].position.set(-0.03, 0.01, -0.03)
  rightHand.position.set(0.012, -0.16, 0.06)
  g.add(rightHand)
  const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.052, 0.26, 10), sleeve)
  rightSleeve.position.set(0.06, -0.3, 0.18)
  rightSleeve.rotation.set(0.45, 0, -0.35)
  g.add(rightSleeve)

  const leftHand = new THREE.Group()
  leftHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.12), glove))
  leftHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.05), glove))
  leftHand.children[1].position.set(0.02, 0.03, 0.04)
  leftHand.position.set(-0.015, -0.09, -0.38)
  g.add(leftHand)
  const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.32, 10), sleeve)
  leftSleeve.position.set(-0.13, -0.24, -0.3)
  leftSleeve.rotation.set(0.7, 0, 0.55)
  g.add(leftSleeve)

  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.008, -0.89)
  g.add(muzzle)
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('flash'), color: 0xffbb70, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  flash.scale.setScalar(0.34)
  flash.position.copy(muzzle.position)
  g.add(flash)
  const flashLight = new THREE.PointLight(0xffa050, 0, 2.2, 2)
  flashLight.position.copy(muzzle.position)
  g.add(flashLight)

  g.userData = { mag, rightHand, leftHand, flash, flashLight, muzzle, dot, magBaseY: mag.position.y, dotBaseScale: 0.012 }
  return g
}

function buildPistol() {
  const g = new THREE.Group()
  const dark = metal(0x252b2d, 0.35, 0.92)
  const black = metal(0x101415, 0.55, 0.7)
  const tan = new THREE.MeshStandardMaterial({ color: 0x7c6248, roughness: 0.8, metalness: 0.06 })
  const glove = new THREE.MeshStandardMaterial({ color: 0x121514, roughness: 0.86 })
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b3029, roughness: 0.92 })
  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m
  }
  // slide/frame
  box(0.048, 0.058, 0.23, dark, 0, 0.025, -0.01)
  box(0.042, 0.032, 0.2, black, 0, -0.012, -0.005)
  box(0.02, 0.014, 0.06, black, 0, 0.058, -0.08)
  box(0.014, 0.012, 0.012, black, 0, 0.065, -0.005)
  box(0.012, 0.012, 0.012, black, 0, 0.062, 0.085)
  // barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10), black)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.025, -0.13); g.add(barrel)
  // grip
  box(0.05, 0.16, 0.07, tan, 0, -0.085, 0.09, -0.18)
  box(0.054, 0.02, 0.074, black, 0, -0.168, 0.105, -0.18)
  // magazine base
  box(0.04, 0.012, 0.058, black, 0, -0.177, 0.105, -0.18)
  // trigger guard
  box(0.01, 0.02, 0.07, black, 0, -0.04, 0.02)
  box(0.01, 0.04, 0.01, black, 0, -0.055, -0.015)
  // suppressor-like muzzle
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.11, 12), dark)
  can.rotation.x = Math.PI / 2; can.position.set(0, 0.025, -0.2); g.add(can)
  const tip = new THREE.Mesh(new THREE.CircleGeometry(0.021, 12), black)
  tip.position.set(0, 0.025, -0.255); g.add(tip)
  // sights
  box(0.008, 0.016, 0.01, black, 0, 0.071, -0.08)
  box(0.008, 0.016, 0.01, black, 0, 0.071, 0.085)
  // hands
  const rightHand = new THREE.Group()
  rightHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.085, 0.11), glove))
  rightHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.04), glove))
  rightHand.position.set(0.015, -0.1, 0.1)
  g.add(rightHand)
  const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.26, 10), sleeve)
  rightSleeve.position.set(0.07, -0.25, 0.2); rightSleeve.rotation.set(0.5, 0, -0.3); g.add(rightSleeve)
  const leftHand = new THREE.Group()
  leftHand.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.1), glove))
  leftHand.position.set(-0.038, -0.075, 0.06); leftHand.rotation.z = -0.25
  g.add(leftHand)
  const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 0.28, 10), sleeve)
  leftSleeve.position.set(-0.08, -0.2, 0.18); leftSleeve.rotation.set(0.55, 0, 0.4); g.add(leftSleeve)

  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.025, -0.27); g.add(muzzle)
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('flash'), color: 0xffbe78, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  flash.scale.setScalar(0.24); flash.position.copy(muzzle.position); g.add(flash)
  const flashLight = new THREE.PointLight(0xffa050, 0, 2, 2)
  flashLight.position.copy(muzzle.position); g.add(flashLight)

  g.userData = { mag: null, rightHand, leftHand, flash, flashLight, muzzle, dot: null, magBaseY: 0, dotBaseScale: 0.01 }
  return g
}

function buildKnife() {
  const g = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: 0x9baab0, roughness: 0.25, metalness: 0.95 })
  const edge = new THREE.MeshStandardMaterial({ color: 0xdfe9ec, roughness: 0.15, metalness: 1 })
  const handle = new THREE.MeshStandardMaterial({ color: 0x181b19, roughness: 0.9 })
  const bladeShape = new THREE.Shape()
  bladeShape.moveTo(0, 0); bladeShape.lineTo(0.028, 0.04); bladeShape.lineTo(0.016, 0.28)
  bladeShape.lineTo(0, 0.34); bladeShape.lineTo(-0.008, 0.24); bladeShape.lineTo(-0.012, 0.02); bladeShape.closePath()
  const geo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })
  const blade = new THREE.Mesh(geo, steel); blade.rotation.x = -Math.PI / 2; g.add(blade)
  const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.3), edge)
  edgeMesh.position.set(0.014, 0, 0.17); g.add(edgeMesh)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.12), handle)
  grip.position.set(0, 0, -0.07); g.add(grip)
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.014), steel)
  guard.position.set(0, 0, 0.002); g.add(guard)
  g.rotation.set(0.1, -0.35, -0.2)
  return g
}

export class WeaponSystem {
  constructor(renderer, audio, environment) {
    this.renderer = renderer
    this.audio = audio
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.01, 5)
    this.scene.environment = environment
    this.scene.environmentIntensity = 0.5
    const hemi = new THREE.HemisphereLight(0x8db4d2, 0x1a1612, 1.5)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffd7b2, 2.6)
    key.position.set(1.5, 2.4, 1.2)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fb7e0, 1.4)
    rim.position.set(-2, 0.4, -1)
    this.scene.add(rim)
    const bounce = new THREE.PointLight(0xff8844, 2, 3, 2)
    bounce.position.set(1, -1, 0.5)
    this.scene.add(bounce)

    this.models = [buildRifle(), buildPistol()]
    this.knife = buildKnife()
    this.knife.position.set(0.3, -0.28, -0.4)
    this.knife.visible = false
    for (const m of this.models) this.scene.add(m)
    this.scene.add(this.knife)

    this.ammo = WEAPONS.map(w => w.magSize)
    this.reserve = [210, 90]
    this.index = 0
    this.fireTimer = 0
    this.reloadT = 0
    this.reloading = false
    this.reloadStage = 0
    this.switchT = 0
    this.switching = false
    this.pendingIndex = 0
    this.adsHeld = false
    this.adsAmount = 0
    this.triggerHeld = false
    this.shotThisFrame = false
    this.meleeT = 0
    this.meleeCooldown = 0
    this.meleeDidHit = false
    this.kick = 0
    this.kickVel = 0
    this.yawKick = 0
    this.swayX = 0
    this.swayY = 0
    this.swayTargetX = 0
    this.swayTargetY = 0
    this.bobPhase = 0
    this.recoilPitch = 0
    this.recoilYaw = 0
    this.shotsFired = 0
    this.shotsHit = 0
    this.muzzleTime = 0
    this.currentFov = 75
    this.baseFov = 75
    this.sprint = 0
    this.lastShotTime = -1
    this.landKick = 0
    this.visible = true
    this.models[0].position.set(0.205, -0.235, -0.52)
    this.models[1].position.set(0.2, -0.245, -0.5)
    this.models[0].rotation.set(0.02, -0.025, 0.015)
    this.models[1].rotation.set(0.02, -0.03, 0.015)
    this.models[1].scale.setScalar(0.94)
    this.magDrop = 0
    this.leftHandOffset = new THREE.Vector3()
    this.deathDrop = 0
  }

  get def() { return WEAPONS[this.index] }
  get mag() { return this.ammo[this.index] }
  get reserveAmmo() { return this.reserve[this.index] }

  reset() {
    this.ammo = WEAPONS.map(w => w.magSize)
    this.reserve = [210, 90]
    this.index = 0
    this.fireTimer = 0
    this.reloadT = 0
    this.reloading = false
    this.reloadStage = 0
    this.switching = false
    this.switchT = 0
    this.pendingIndex = 0
    this.adsHeld = false
    this.adsAmount = 0
    this.triggerHeld = false
    this.lastTrigger = false
    this.shotThisFrame = false
    this.meleeT = 0
    this.meleeCooldown = 0
    this.meleeDidHit = false
    this.kick = 0
    this.kickVel = 0
    this.yawKick = 0
    this.swayX = 0
    this.swayY = 0
    this.swayTargetX = 0
    this.swayTargetY = 0
    this.bobPhase = 0
    this.recoilPitch = 0
    this.recoilYaw = 0
    this.shotsFired = 0
    this.shotsHit = 0
    this.muzzleTime = 0
    this.currentFov = this.baseFov
    this.sprint = 0
    this.landKick = 0
    this.lastShotTime = -1
    this.knife.visible = false
  }

  setAspect(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  triggerDown() {
    if (this.switching || this.reloading) return
    this.triggerHeld = true
    if (!this.def.auto) this.tryFire()
  }
  triggerUp() { this.triggerHeld = false }

  setAds(v) { this.adsHeld = v }

  reload() {
    if (this.reloading || this.switching) return false
    if (this.mag >= this.def.magSize || this.reserveAmmo <= 0) return false
    this.reloading = true
    this.reloadT = 0
    this.reloadStage = 0
    this.audio.reloadStep(0)
    return true
  }

  switchTo(i) {
    if (i === this.index || this.switching) return false
    if (i < 0 || i >= WEAPONS.length) return false
    this.switching = true
    this.switchT = 0
    this.pendingIndex = i
    this.reloading = false
    return true
  }

  nextWeapon() { return this.switchTo((this.index + 1) % WEAPONS.length) }

  tryFire() {
    if (this.reloading || this.switching || this.meleeT > 0) return false
    if (this.fireTimer > 0) return false
    const def = this.def
    if (this.ammo[this.index] <= 0) {
      this.audio.dryFire()
      this.fireTimer = 0.25
      this.reload()
      return false
    }
    this.ammo[this.index]--
    this.fireTimer = 60 / def.rpm
    this.shotsFired++
    this.shotThisFrame = true
    this.lastShotTime = performance.now() / 1000
    const ads = this.adsAmount
    const kickScale = ads > 0.5 ? 0.72 : 1
    this.kick = 1
    this.kickVel = 2.6
    this.yawKick = rand(-1, 1) * (ads > 0.5 ? 0.35 : 1)
    this.recoilPitch += def.recoil * kickScale
    this.recoilYaw += this.yawKick * def.recoilYaw
    this.muzzleTime = 0.05
    this.audio.shot(def.kind)
    return true
  }

  melee() {
    if (this.meleeCooldown > 0 || this.switching || this.reloading) return false
    this.meleeT = 0.5
    this.meleeCooldown = 0.9
    this.meleeDidHit = false
    this.audio.melee()
    return true
  }

  consumeMeleeHit() {
    if (this.meleeT > 0 && this.meleeT < 0.34 && !this.meleeDidHit) {
      this.meleeDidHit = true
      return true
    }
    return false
  }

  update(dt, input) {
    this.shotThisFrame = false
    this.triggerHeld = input.fireHeld
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt)
    this.muzzleTime = Math.max(0, this.muzzleTime - dt)
    this.landKick = Math.max(0, this.landKick - dt * 3)

    const def = this.def
    const canAds = !this.reloading && !this.switching && this.meleeT <= 0 && !input.sprinting
    const targetAds = this.adsHeld && canAds ? 1 : 0
    this.adsAmount = damp(this.adsAmount, targetAds, 12, dt)
    this.sprint = damp(this.sprint, input.sprinting ? 1 : 0, 9, dt)

    this.kickVel += (-this.kick * 150 - this.kickVel * 16) * dt
    this.kick += this.kickVel * dt
    this.kick = clamp(this.kick, 0, 1.6)
    this.yawKick = damp(this.yawKick, 0, 8, dt)
    this.swayTargetX = clamp(input.mouseDX * 0.00016, -0.03, 0.03)
    this.swayTargetY = clamp(input.mouseDY * 0.00016, -0.03, 0.03)
    this.swayX = damp(this.swayX, this.swayTargetX, 9, dt)
    this.swayY = damp(this.swayY, this.swayTargetY, 9, dt)

    const speedFactor = clamp(input.speed / 7, 0, 1.4)
    this.bobPhase += dt * (input.sprinting ? 12.5 : 8.2) * Math.min(1, speedFactor + 0.25)
    const bobAmp = speedFactor * (1 - this.adsAmount * 0.82) * (input.grounded ? 1 : 0.3)
    const bobX = Math.sin(this.bobPhase) * 0.009 * bobAmp
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.008 * bobAmp

    // firing
    if (input.fireHeld && !this.switching && !this.reloading && this.meleeT <= 0) {
      if (def.auto) this.tryFire()
      else if (!this.lastTrigger) this.tryFire()
    }
    this.lastTrigger = input.fireHeld
    if (input.fireHeld && this.ammo[this.index] === 0 && !this.reloading && !this.switching) this.reload()

    // reload timeline
    if (this.reloading) {
      this.reloadT += dt
      const t = this.reloadT / def.reloadTime
      if (t > 0.18 && this.reloadStage === 0) { this.reloadStage = 1; this.audio.reloadStep(1) }
      if (t > 0.66 && this.reloadStage === 1) { this.reloadStage = 2; this.audio.reloadStep(2) }
      if (t > 0.86 && this.reloadStage === 2) { this.reloadStage = 3; this.audio.reloadStep(3) }
      if (t >= 1) {
        const need = def.magSize - this.ammo[this.index]
        const take = Math.min(need, this.reserveAmmo)
        this.ammo[this.index] += take
        this.reserve[this.index] -= take
        this.reloading = false
        this.reloadStage = 0
        this.reloadT = 0
      }
    }

    // switching
    if (this.switching) {
      this.switchT += dt
      if (this.switchT > 0.24 && this.pendingIndex !== this.index) {
        this.index = this.pendingIndex
        this.audio.reloadStep(3)
      }
      if (this.switchT > 0.56) { this.switching = false; this.switchT = 0 }
    }

    if (this.meleeT > 0) this.meleeT = Math.max(0, this.meleeT - dt)
    if (this.meleeT > 0.26) this.knife.visible = true
    else this.knife.visible = false

    // model placement
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i]
      model.visible = i === this.index && this.visible
      if (!model.visible) continue
      const isRifle = i === 0
      const hip = isRifle ? new THREE.Vector3(0.205, -0.235, -0.52) : new THREE.Vector3(0.2, -0.245, -0.5)
      const ads = isRifle ? new THREE.Vector3(0, -0.072, -0.435) : new THREE.Vector3(0, -0.077, -0.4)
      const base = hip.clone().lerp(ads, this.adsAmount)
      const reloadCurve = this.reloading ? Math.sin(clamp(this.reloadT / def.reloadTime, 0, 1) * Math.PI) : 0
      const switchCurve = this.switching ? Math.sin(clamp(this.switchT / 0.56, 0, 1) * Math.PI) : 0
      const k = this.kick
      base.x += this.swayX * (1 - this.adsAmount * 0.8) + bobX + (this.adsAmount < 0.5 ? this.sprint * 0.025 : 0)
      base.y += this.swayY * (1 - this.adsAmount * 0.8) - bobY - reloadCurve * 0.055 - switchCurve * 0.28 + this.sprint * -0.025 - this.landKick * 0.02
      base.z += k * 0.055 + reloadCurve * 0.02
      model.position.copy(base)
      const recoilTilt = k * 0.055
      const rotX = (isRifle ? 0.02 : 0.02) + this.swayY * 0.6 + recoilTilt + reloadCurve * -0.5 + switchCurve * 0.35
      const rotY = (isRifle ? -0.025 : -0.03) * (1 - this.adsAmount) + this.swayX * 0.8 + this.yawKick * 0.018
      const rotZ = 0.015 + this.swayX * 0.9 + reloadCurve * -0.6 + this.sprint * -0.16 + switchCurve * 0.8
      model.rotation.set(rotX, rotY, rotZ)

      const ud = model.userData
      if (ud.mag) {
        const md = this.reloading ? Math.max(0, Math.sin(clamp((this.reloadT / def.reloadTime - 0.12) / 0.52, 0, 1) * Math.PI)) : 0
        ud.mag.position.y = ud.magBaseY - md * 0.24
        ud.mag.rotation.z = md * 0.5
      }
      if (ud.leftHand) {
        const lh = this.reloading ? Math.sin(clamp(this.reloadT / def.reloadTime, 0, 1) * Math.PI) : 0
        ud.leftHand.position.y = -0.09 - lh * 0.08
        ud.leftHand.position.z = -0.38 + lh * 0.26
      }
      if (ud.flash) {
        ud.flash.material.opacity = this.muzzleTime > 0 ? rand(0.7, 1) : 0
        ud.flash.material.rotation = rand(0, 6.28)
        ud.flash.scale.setScalar(rand(0.28, 0.42))
      }
      if (ud.flashLight) ud.flashLight.intensity = this.muzzleTime > 0 ? 3 : 0
      if (ud.dot) {
        const target = this.adsAmount > 0.65 ? 0.014 : 0.01
        ud.dot.scale.setScalar(damp(ud.dot.scale.x, target, 8, dt))
        ud.dot.material.opacity = this.adsAmount > 0.5 ? 0.95 : 0.55
      }
    }

    // knife slash
    if (this.knife.visible) {
      const t = 1 - this.meleeT / 0.5
      const slash = Math.sin(t * Math.PI)
      this.knife.position.set(0.3 - slash * 0.45, -0.26 + slash * 0.08, -0.38 - slash * 0.15)
      this.knife.rotation.set(0.1 + slash * 0.6, -0.35 - slash * 0.8, -0.2 + slash * 1.6)
      this.knife.scale.setScalar(1)
    }

    // fov
    this.currentFov = lerp(this.baseFov, def.adsFov, this.adsAmount)
    this.camera.fov = this.currentFov
    this.camera.updateProjectionMatrix()
  }

  getSpread(moving) {
    const def = this.def
    const base = lerp(def.spreadHip, def.spreadAds, this.adsAmount)
    const move = this.adsAmount > 0.5 ? 0.002 : 0.014
    return base + (moving ? move : 0) + Math.min(0.02, this.kick * 0.004)
  }

  consumeRecoil() {
    const p = this.recoilPitch
    const y = this.recoilYaw
    this.recoilPitch = 0
    this.recoilYaw = 0
    return { pitch: p, yaw: y }
  }

  getState() {
    const def = this.def
    return {
      name: def.name, short: def.short, mode: def.mode, mag: this.ammo[this.index], reserve: this.reserve[this.index],
      reloading: this.reloading, reloadProgress: this.reloading ? clamp(this.reloadT / def.reloadTime, 0, 1) : 0,
      ads: this.adsAmount, switching: this.switching, index: this.index, melee: this.meleeT > 0,
      maxMag: def.magSize,
    }
  }

  addAmmo(frac = 0.5) {
    for (let i = 0; i < this.reserve.length; i++) {
      this.reserve[i] = Math.min(WEAPONS[i].reserveMax, this.reserve[i] + Math.ceil(WEAPONS[i].reserveMax * frac))
    }
    this.ammo[this.index] = Math.min(WEAPONS[this.index].magSize, this.ammo[this.index] + Math.ceil(WEAPONS[this.index].magSize * 0.5))
  }
}
