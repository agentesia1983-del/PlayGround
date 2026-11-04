import * as THREE from 'three'
import { spriteTexture } from './textures.js'

const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt))
const TAU = Math.PI * 2

export const ENEMY_TYPES = {
  grunt: {
    name: 'GRUNT', hp: 100, speed: 2.65, scale: 1, damage: 8, accuracy: 0.42,
    rangeMin: 9, rangeMax: 24, burst: [3, 5], burstGap: 0.13, fireGap: [1.7, 2.8],
    score: 100, drop: 0.3, eye: 0x74d8ff, cloth: 0x394137, vest: 0x181d1a, plate: 0x242a26,
  },
  rusher: {
    name: 'RUSHER', hp: 70, speed: 4.35, scale: 0.96, damage: 6, accuracy: 0.34,
    rangeMin: 4, rangeMax: 15, burst: [5, 8], burstGap: 0.085, fireGap: [1.3, 2.1],
    score: 125, drop: 0.22, eye: 0xff3c2c, cloth: 0x4a2c24, vest: 0x1d1715, plate: 0x2a1a16,
  },
  sniper: {
    name: 'MARKSMAN', hp: 80, speed: 2.1, scale: 1.02, damage: 22, accuracy: 0.78,
    rangeMin: 22, rangeMax: 34, burst: [1, 1], burstGap: 0.2, fireGap: [2.6, 3.8],
    score: 175, drop: 0.3, eye: 0x9cffb4, cloth: 0x27332a, vest: 0x161c17, plate: 0x1d241f, sniper: true,
  },
  heavy: {
    name: 'JUGGERNAUT', hp: 320, speed: 1.65, scale: 1.24, damage: 7, accuracy: 0.3,
    rangeMin: 8, rangeMax: 22, burst: [10, 16], burstGap: 0.075, fireGap: [1.5, 2.4],
    score: 350, drop: 1, eye: 0xff8a32, cloth: 0x32363a, vest: 0x141719, plate: 0x1d2225, heavy: true, boss: false,
  },
  boss: {
    name: 'WARDEN', hp: 1500, speed: 1.55, scale: 1.55, damage: 9, accuracy: 0.38,
    rangeMin: 8, rangeMax: 26, burst: [14, 20], burstGap: 0.065, fireGap: [1.1, 1.8],
    score: 1500, drop: 1, eye: 0xff1a0a, cloth: 0x232327, vest: 0x0c0d0f, plate: 0x16161a, heavy: true, boss: true,
  },
}

let cache = null
function materials() {
  if (cache) return cache
  cache = {
    glove: new THREE.MeshStandardMaterial({ color: 0x0d0f0e, roughness: 0.9 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.82, metalness: 0.15 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x1b2022, roughness: 0.45, metalness: 0.85 }),
    lens: new THREE.MeshBasicMaterial({ color: 0x182228 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 0.85 }),
  }
  return cache
}

function geoBox(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = true; m.receiveShadow = true
  parent.add(m)
  return m
}

function buildEnemyModel(type) {
  const cfg = ENEMY_TYPES[type]
  const M = materials()
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const cloth = new THREE.MeshStandardMaterial({ color: cfg.cloth, roughness: 0.88, metalness: 0.05 })
  const vest = new THREE.MeshStandardMaterial({ color: cfg.vest, roughness: 0.72, metalness: 0.18 })
  const plate = new THREE.MeshStandardMaterial({ color: cfg.plate, roughness: 0.55, metalness: 0.35 })
  const eye = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: cfg.eye, emissiveIntensity: 2.8, roughness: 0.4 })
  const core = new THREE.MeshStandardMaterial({ color: 0x100302, emissive: 0xff2a10, emissiveIntensity: 3.6, roughness: 0.4 })

  // legs
  const legs = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.14, 0.94, 0)
    geoBox(0.16, 0.43, 0.18, cloth, 0, -0.2, 0, hip)
    geoBox(0.14, 0.4, 0.16, cloth, 0, -0.59, 0, hip)
    geoBox(0.16, 0.13, 0.26, M.boot, 0, -0.84, -0.03, hip)
    geoBox(0.17, 0.12, 0.14, plate, 0, -0.3, -0.02, hip)
    body.add(hip)
    legs.push(hip)
  }
  // torso
  geoBox(0.5, 0.56, 0.3, cloth, 0, 1.27, 0, body)
  const vestMesh = geoBox(0.55, 0.46, 0.37, vest, 0, 1.28, -0.01, body)
  geoBox(0.5, 0.16, 0.39, plate, 0, 1.36, 0, body)
  for (let i = 0; i < 3; i++) geoBox(0.12, 0.13, 0.07, plate, -0.17 + i * 0.17, 1.1, -0.2, body)
  geoBox(0.16, 0.2, 0.09, vest, 0.32, 1.2, 0.12, body)
  // shoulder pads
  for (const side of [-1, 1]) {
    geoBox(0.2, 0.14, 0.3, plate, side * 0.31, 1.47, 0, body)
    geoBox(0.09, 0.2, 0.24, plate, side * 0.4, 1.37, 0, body)
  }
  // backpack
  geoBox(0.36, 0.4, 0.18, vest, 0, 1.3, 0.22, body)
  // head
  const head = new THREE.Group()
  head.position.set(0, 1.68, 0)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), M.skin)
  skull.scale.set(0.94, 1.05, 0.95); skull.castShadow = true
  head.add(skull)
  geoBox(0.25, 0.12, 0.28, vest, 0, 0.02, 0.02, head)
  // helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10, 0, TAU, 0, Math.PI * 0.6), plate)
  helmet.position.y = 0.055
  helmet.castShadow = true
  head.add(helmet)
  geoBox(0.3, 0.045, 0.34, plate, 0, 0.01, 0, head)
  const visor = geoBox(0.21, 0.045, 0.02, eye, 0, -0.01, -0.155, head)
  geoBox(0.06, 0.08, 0.05, plate, -0.17, 0.03, 0, head)
  body.add(head)

  // arms
  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.33, 1.46, 0)
    geoBox(0.14, 0.34, 0.16, cloth, 0, -0.17, 0, shoulder)
    const fore = new THREE.Group(); fore.position.set(0, -0.36, 0)
    geoBox(0.12, 0.32, 0.14, cloth, 0, -0.14, 0, fore)
    const hand = geoBox(0.12, 0.12, 0.16, M.glove, 0, -0.32, -0.02, fore)
    shoulder.add(fore)
    body.add(shoulder)
    arms.push({ shoulder, fore, hand })
  }
  // weapon
  const weapon = new THREE.Group()
  weapon.position.set(0.16, 1.23, -0.23)
  const gunMat = M.metal
  if (cfg.heavy) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 10), gunMat)
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.28; weapon.add(barrel)
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), gunMat)
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(i / 5 * TAU) * 0.045, Math.sin(i / 5 * TAU) * 0.045, -0.35)
      weapon.add(b)
    }
    geoBox(0.2, 0.2, 0.36, gunMat, 0, 0, 0.05, weapon)
    geoBox(0.08, 0.12, 0.14, vest, 0, -0.14, 0.12, weapon)
  } else {
    geoBox(0.075, 0.09, 0.4, gunMat, 0, 0, -0.1, weapon)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, cfg.sniper ? 0.55 : 0.3, 8), gunMat)
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, cfg.sniper ? -0.55 : -0.42); weapon.add(barrel)
    geoBox(0.05, 0.13, 0.08, vest, 0, -0.1, -0.04, weapon)
    geoBox(0.04, 0.05, 0.22, vest, 0, -0.01, 0.16, weapon)
    if (cfg.sniper) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), gunMat)
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.08, -0.12); weapon.add(scope)
    }
  }
  body.add(weapon)
  // arms aiming pose
  arms[0].shoulder.rotation.set(-1.1, 0, 0.22)
  arms[0].fore.rotation.set(0.2, 0, 0)
  arms[1].shoulder.rotation.set(-1.25, 0, -0.55)
  arms[1].fore.rotation.set(0.45, 0, 0.2)

  if (cfg.boss) {
    // armor mantle
    for (const side of [-1, 1]) {
      geoBox(0.24, 0.38, 0.5, plate, side * 0.38, 1.42, 0.02, body)
    }
    geoBox(0.5, 0.16, 0.12, plate, 0, 1.62, -0.2, body)
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), core)
    coreMesh.position.set(0, 1.25, -0.235)
    body.add(coreMesh)
    // chest spikes
    for (const side of [-1, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), plate)
      spike.position.set(side * 0.24, 1.52, -0.2); spike.rotation.x = -0.3
      body.add(spike)
    }
    head.scale.setScalar(1.12)
  }

  // hitboxes (invisible)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hitMat)
  headHit.position.set(0, 1.72, 0)
  const bodyHit = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 0.42), hitMat)
  bodyHit.position.set(0, 1.26, 0)
  const legsHit = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.88, 0.32), hitMat)
  legsHit.position.set(0, 0.52, 0)
  root.add(headHit, bodyHit, legsHit)
  let coreHit = null
  if (cfg.boss) {
    coreHit = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), hitMat)
    coreHit.position.set(0, 1.25, -0.25)
    root.add(coreHit)
  }

  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.01, cfg.sniper ? -0.86 : cfg.heavy ? -0.62 : -0.68)
  weapon.add(muzzle)

  root.scale.setScalar(cfg.scale)
  return { root, body, head, legs, arms, weapon, muzzle, hitMeshes: [headHit, bodyHit, legsHit, ...(coreHit ? [coreHit] : [])], coreMesh: cfg.boss ? body.children.find(c => c.geometry?.type === 'SphereGeometry' && c.material === core) : null, headHit, bodyHit, legsHit, coreHit, visor }
}

function disposeGroup(group) {
  group.traverse(o => { if (o.isMesh) o.geometry?.dispose?.() })
}

export class EnemySystem {
  constructor(scene, world, effects, audio) {
    this.scene = scene
    this.world = world
    this.effects = effects
    this.audio = audio
    this.enemies = []
    this.projectiles = []
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = 160
    this.tmp = new THREE.Vector3()
    this.tmp2 = new THREE.Vector3()
    this.losTimer = 0
    this.onPlayerDamage = null
    this.onKill = null
    this.onBossHit = null
    this.healthBarsVisible = false
  }

  spawn(type, pos, { banner = false } = {}) {
    const cfg = ENEMY_TYPES[type]
    const model = buildEnemyModel(type)
    const root = model.root
    const y = this.world.groundHeightAt(pos.x, pos.z)
    root.position.set(pos.x, y, pos.z)
    this.scene.add(root)
    model.hitMeshes.forEach(h => { h.userData.enemy = null; h.userData.zone = h === model.headHit ? 'head' : h === model.legsHit ? 'limb' : h === model.coreHit ? 'core' : 'body' })
    const e = {
      type, cfg, ...model, root, health: cfg.hp, maxHealth: cfg.hp,
      alive: true, dead: false, deadT: 0, deathSign: Math.random() > 0.5 ? 1 : -1,
      state: 'combat', alerted: true, los: false, losTimer: rand(0, 0.25),
      fireTimer: rand(0.5, 1.8), burstLeft: 0, burstTimer: 0, aimTimer: 0, aiming: false,
      strafeDir: Math.random() > 0.5 ? 1 : -1, strafeTimer: rand(1.2, 3),
      repoTimer: rand(2, 5), coverTarget: null, walkPhase: rand(0, 6.28), moveSpeed: 0,
      spawnT: 0, flashT: 0, suppressT: 0, lastSeen: 0, muzzleGlow: 0, radius: 0.38,
      meleeTimer: 0, laser: null, rocketTimer: rand(4, 7), boss: cfg.boss, hitFlash: 0,
    }
    model.hitMeshes.forEach(h => { h.userData.enemy = e })
    e.laser = this.makeLaser()
    if (cfg.sniper) e.laser.visible = false
    this.enemies.push(e)
    // spawn flare
    for (let i = 0; i < 10; i++) {
      this.effects.smoke.spawn({
        pos: new THREE.Vector3(pos.x + rand(-0.5, 0.5), y + rand(0.2, 1.8), pos.z + rand(-0.5, 0.5)),
        vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)),
        color: [0.22, 0.2, 0.19], size: rand(0.4, 0.8), life: rand(0.8, 1.6), gravity: -0.2, drag: 0.94, grow: 0.8, alpha: 0.4,
      })
    }
    return e
  }

  makeLaser() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)])
    const mat = new THREE.LineBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    this.scene.add(line)
    return line
  }

  aliveCount() { return this.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0) }

  getBoss() {
    const b = this.enemies.find(e => e.boss && !e.dead)
    return b ? { name: b.cfg.name, hp: b.health, max: b.maxHealth } : null
  }

  hitMeshes() {
    const arr = []
    for (const e of this.enemies) if (!e.dead) arr.push(...e.hitMeshes)
    return arr
  }

  raycast(origin, dir, maxDist = 130) {
    this.raycaster.set(origin, dir)
    this.raycaster.far = maxDist
    const hits = this.raycaster.intersectObjects(this.hitMeshes(), false)
    for (const h of hits) {
      const e = h.object.userData.enemy
      if (!e || e.dead) continue
      return { enemy: e, zone: h.object.userData.zone || 'body', point: h.point, distance: h.distance, normal: h.face?.normal || new THREE.Vector3(0, 1, 0) }
    }
    return null
  }

  damage(e, amount, zone, point, dir) {
    if (e.dead) return { dead: false, damage: 0 }
    let dmg = amount
    if (zone === 'head') dmg *= e.cfg.sniper ? 2.2 : 2.4
    else if (zone === 'limb') dmg *= 0.72
    else if (zone === 'core') dmg *= 2.4
    e.health -= dmg
    e.hitFlash = 0.12
    e.suppressT = Math.max(e.suppressT, 0.35)
    this.effects.blood(point, dir, zone === 'head' ? 1.4 : 1)
    if (e.cfg.boss && zone === 'core') {
      for (let i = 0; i < 10; i++) {
        this.effects.sparks.spawn({
          pos: point.clone(), vel: new THREE.Vector3(rand(-4, 4), rand(0, 5), rand(-4, 4)),
          color: [1, 0.35, 0.15], size: rand(0.04, 0.1), life: rand(0.2, 0.5), gravity: 5, drag: 0.9,
        })
      }
    }
    // flinch
    e.aimTimer = Math.max(e.aimTimer, e.cfg.sniper ? 0.4 : 0.15)
    if (e.health <= 0) {
      this.kill(e, zone === 'head' || zone === 'core', dir)
      return { dead: true, damage: dmg, headshot: zone === 'head' || zone === 'core' }
    }
    return { dead: false, damage: dmg, headshot: zone === 'head' }
  }

  kill(e, headshot, dir) {
    e.dead = true
    e.alive = false
    e.deadT = 0
    e.deathSign = Math.random() > 0.5 ? 1 : -1
    e.laser.visible = false
    e.laser.material.opacity = 0
    if (e.cfg.boss) {
      // boss death spectacle
      this.effects.explosion(e.root.position.clone().setY(e.root.position.y + 1.4), { radius: 7 })
    }
    for (let i = 0; i < 14; i++) {
      this.effects.blood(new THREE.Vector3(e.root.position.x, e.root.position.y + rand(0.8, 1.6), e.root.position.z), new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)), 1)
    }
    this.onKill?.(e, { headshot, dir })
  }

  spawnRocket(e, player) {
    const start = new THREE.Vector3()
    e.muzzle.getWorldPosition(start)
    const target = player.cameraPos.clone()
    const dir = target.sub(start).normalize()
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a0b06, emissive: 0xff4a15, emissiveIntensity: 4 }))
    mesh.position.copy(start)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('glow'), color: 0xff5a20, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(0.9, 0.9, 1)
    mesh.add(glow)
    this.scene.add(mesh)
    this.projectiles.push({ mesh, vel: dir.multiplyScalar(15).add(new THREE.Vector3(0, 1.2, 0)), life: 6, trail: 0 })
    this.audio.enemyShot(8, 0, true)
  }

  update(dt, time, player) {
    this.losTimer -= dt
    const playerChest = this.tmp.set(player.pos.x, player.pos.y + (player.crouching ? 0.9 : 1.35), player.pos.z)
    const cameraPos = player.cameraPos

    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT += dt
        e.body.rotation.z = damp(e.body.rotation.z, e.deathSign * 1.45, 4, dt)
        e.body.position.y = damp(e.body.position.y, -0.55, 3, dt)
        if (e.deadT > 2.6) {
          e.root.position.y -= dt * 0.65
          e.body.rotation.x = damp(e.body.rotation.x, -0.2, 2, dt)
        }
        if (e.deadT > 3.8 && !e.removed) {
          e.removed = true
          this.scene.remove(e.root)
          this.scene.remove(e.laser)
          e.laser.geometry.dispose(); e.laser.material.dispose()
          disposeGroup(e.root)
        }
        continue
      }

      e.spawnT += dt
      const scale = e.cfg.scale
      const grow = clamp(e.spawnT / 0.35, 0, 1)
      e.root.scale.setScalar(scale * (0.7 + grow * 0.3))
      if (e.spawnT < 0.35) continue

      e.hitFlash = Math.max(0, e.hitFlash - dt)
      e.suppressT = Math.max(0, e.suppressT - dt)
      e.muzzleGlow = Math.max(0, e.muzzleGlow - dt)
      e.fireTimer -= dt
      e.strafeTimer -= dt
      e.repoTimer -= dt
      e.rocketTimer -= dt

      const dx = player.pos.x - e.root.position.x
      const dz = player.pos.z - e.root.position.z
      const dist = Math.hypot(dx, dz)
      const dirToPlayer = this.tmp2.set(dx, 0, dz).normalize()

      // LOS, throttled
      e.losTimer -= dt
      if (e.losTimer <= 0) {
        e.losTimer = 0.18 + Math.random() * 0.08
        e.los = this.checkLOS(e, cameraPos, playerChest)
      }

      if (e.cfg.boss && e.rocketTimer <= 0 && e.los && dist > 7) {
        this.spawnRocket(e, player)
        e.rocketTimer = rand(7.5, 11)
        e.fireTimer = Math.max(e.fireTimer, 0.5)
      }

      // movement
      let moveDir = new THREE.Vector3()
      let speed = e.cfg.speed
      const minR = e.cfg.rangeMin, maxR = e.cfg.rangeMax
      if (e.cfg.rusher && dist < 6.5) {
        moveDir.copy(dirToPlayer).multiplyScalar(0.2)
        speed *= 0.35
        if (e.meleeTimer <= 0) {
          e.meleeTimer = 1.3
          if (dist < 2.1 && e.los) {
            this.onPlayerDamage?.(13, e.root.position.clone().setY(e.root.position.y + 1.2), e)
            this.effects.blood(playerChest.clone(), new THREE.Vector3(rand(-1, 1), 1, rand(-1, 1)), 0.5)
          }
        }
      } else if (e.coverTarget) {
        const cdx = e.coverTarget.x - e.root.position.x, cdz = e.coverTarget.z - e.root.position.z
        const cd = Math.hypot(cdx, cdz)
        if (cd < 0.6) { e.coverTarget = null }
        else { moveDir.set(cdx / cd, 0, cdz / cd); speed *= 1.25 }
      } else if (dist > maxR) {
        moveDir.copy(dirToPlayer)
        // slight flank bias
        moveDir.x += Math.cos(time * 0.4 + e.walkPhase) * 0.25
        moveDir.z += Math.sin(time * 0.4 + e.walkPhase) * 0.25
        moveDir.normalize()
      } else if (dist < minR) {
        moveDir.copy(dirToPlayer).multiplyScalar(-1)
        if (e.cfg.sniper) speed *= 1.2
      } else {
        const strafe = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).multiplyScalar(e.strafeDir)
        moveDir.copy(strafe).multiplyScalar(0.85).addScaledVector(dirToPlayer, Math.sin(time * 0.7 + e.walkPhase) * 0.2)
        moveDir.normalize()
      }
      if (e.strafeTimer <= 0) {
        e.strafeTimer = rand(1.4, 3.6)
        if (Math.random() > 0.35) e.strafeDir *= -1
      }
      if (e.repoTimer <= 0) {
        e.repoTimer = rand(3.5, 7)
        if (!e.cfg.boss && !e.cfg.heavy && Math.random() < 0.5) {
          let best = null, bestD = 12
          for (const c of this.world.coverPoints) {
            const d = c.distanceTo(e.root.position)
            if (d < bestD && d > 0.5) { best = c; bestD = d }
          }
          if (best && bestD < 9) e.coverTarget = best
        }
      }
      e.meleeTimer = Math.max(0, e.meleeTimer - dt)

      if (moveDir.lengthSq() > 0.001) {
        const moved = this.moveEnemy(e, moveDir, speed, dt)
        e.moveSpeed = damp(e.moveSpeed, moved ? speed : 0, 8, dt)
      } else e.moveSpeed = damp(e.moveSpeed, 0, 8, dt)

      // separation
      for (const o of this.enemies) {
        if (o === e || o.dead) continue
        const sx = e.root.position.x - o.root.position.x
        const sz = e.root.position.z - o.root.position.z
        const d = Math.hypot(sx, sz)
        const min = 1.0 + (e.cfg.scale + o.cfg.scale) * 0.25
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5
          e.root.position.x += sx / d * push
          e.root.position.z += sz / d * push
        }
      }
      this.world.boundsClamp(e.root.position, 0.5)
      e.root.position.y = damp(e.root.position.y, this.world.groundHeightAt(e.root.position.x, e.root.position.z), 12, dt)

      // face player
      const targetYaw = Math.atan2(-dx, -dz)
      let delta = targetYaw - e.root.rotation.y
      while (delta > Math.PI) delta -= TAU
      while (delta < -Math.PI) delta += TAU
      e.root.rotation.y += delta * Math.min(1, dt * (e.aiming ? 7 : 4.5))

      // walk animation
      const moveAmt = clamp(e.moveSpeed / e.cfg.speed, 0, 1)
      e.walkPhase += dt * (4.5 + moveAmt * 5.5)
      const swing = Math.sin(e.walkPhase) * 0.65 * moveAmt
      e.legs[0].rotation.x = swing
      e.legs[1].rotation.x = -swing
      e.body.position.y = Math.abs(Math.sin(e.walkPhase)) * 0.035 * moveAmt + Math.sin(time * 1.6 + e.walkPhase) * 0.008
      if (e.arms) {
        e.arms[0].shoulder.rotation.x = -1.1 + Math.sin(e.walkPhase) * 0.05 * moveAmt
        e.arms[1].shoulder.rotation.x = -1.25 - Math.sin(e.walkPhase) * 0.04 * moveAmt
      }

      // shooting
      if (e.cfg.sniper) this.updateSniper(e, dt, player, playerChest, dist)
      else this.updateGunfire(e, dt, player, dist)

      // footstep audio
      if (e.moveSpeed > 1 && dist < 14 && Math.random() < dt * 3.5) this.audio.footstep(false)

      // core pulse
      if (e.cfg.boss && e.coreMesh) e.coreMesh.material.emissiveIntensity = 2.8 + Math.sin(time * 5) * 1.2
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.life -= dt
      p.vel.y -= 4.5 * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.trail -= dt
      if (p.trail <= 0) {
        p.trail = 0.03
        this.effects.smoke.spawn({
          pos: p.mesh.position.clone(), vel: new THREE.Vector3(rand(-0.15, 0.15), rand(0.05, 0.25), rand(-0.15, 0.15)),
          color: [0.25, 0.24, 0.23], size: 0.35, life: 0.8, gravity: -0.3, drag: 0.94, grow: 0.7, alpha: 0.4,
        })
      }
      const floor = this.world.groundHeightAt(p.mesh.position.x, p.mesh.position.z)
      let hit = p.mesh.position.y < floor + 0.2
      if (!hit) {
        for (const c of this.world.colliders) {
          if (p.mesh.position.x > c.minX && p.mesh.position.x < c.maxX && p.mesh.position.z > c.minZ && p.mesh.position.z < c.maxZ && p.mesh.position.y > c.minY && p.mesh.position.y < c.maxY) { hit = true; break }
        }
      }
      if (hit || p.life <= 0) {
        const pos = p.mesh.position.clone()
        this.effects.explosion(pos, { radius: 4.5 })
        this.audio.explosion(pos.distanceTo(player.pos), 0)
        const pd = pos.distanceTo(player.pos)
        if (pd < 5.2) {
          const dmg = 34 * (1 - pd / 6)
          this.onPlayerDamage?.(dmg, pos, null)
        }
        this.scene.remove(p.mesh)
        p.mesh.geometry.dispose(); p.mesh.material.dispose()
        this.projectiles.splice(i, 1)
      }
    }
    this.audio.setIntensity(clamp(this.aliveCount() / 8, 0, 1))
  }

  moveEnemy(e, dir, speed, dt) {
    const r = e.radius
    const pos = e.root.position
    const tryMove = (dx, dz) => {
      const nx = pos.x + dx, nz = pos.z + dz
      if (nx < -33.5 || nx > 33.5 || nz < -33.5 || nz > 33.5) return false
      const gh = this.world.groundHeightAt(nx, nz)
      if (gh - pos.y > 0.5) return false
      if (this.world.colliderAt(nx, nz, r, pos.y, 1.7)) return false
      pos.x = nx; pos.z = nz
      return true
    }
    const step = speed * dt
    if (tryMove(dir.x * step, dir.z * step)) return true
    const angles = [0.6, -0.6, 1.2, -1.2, 1.9, -1.9]
    for (const a of angles) {
      const c = Math.cos(a), s = Math.sin(a)
      const nx = dir.x * c - dir.z * s
      const nz = dir.x * s + dir.z * c
      if (tryMove(nx * step, nz * step)) return true
    }
    return false
  }

  checkLOS(e, cameraPos, playerChest) {
    const origin = new THREE.Vector3(e.root.position.x, e.root.position.y + 1.55 * e.cfg.scale, e.root.position.z)
    const dir = playerChest.clone().sub(origin)
    const dist = dir.length()
    dir.normalize()
    this.raycaster.set(origin, dir)
    this.raycaster.far = dist - 0.4
    const hits = this.raycaster.intersectObjects(this.world.raycastTargets, true)
    return hits.length === 0
  }

  updateGunfire(e, dt, player, dist) {
    if (!e.los) {
      e.burstLeft = 0
      e.aiming = false
      return
    }
    if (e.burstLeft > 0) {
      e.burstTimer -= dt
      if (e.burstTimer <= 0) {
        e.burstTimer = e.cfg.burstGap
        this.enemyFire(e, player, dist)
        e.burstLeft--
        if (e.burstLeft <= 0) e.fireTimer = rand(e.cfg.fireGap[0], e.cfg.fireGap[1])
      }
      return
    }
    if (e.fireTimer <= 0 && dist < 42) {
      e.aiming = true
      e.aimTimer += dt
      const windup = e.cfg.heavy ? 0.35 : 0.55
      if (e.aimTimer > windup) {
        e.burstLeft = Math.round(rand(e.cfg.burst[0], e.cfg.burst[1]))
        e.burstTimer = 0
        e.aimTimer = 0
        e.aiming = false
      }
    }
  }

  updateSniper(e, dt, player, playerChest, dist) {
    if (!e.los) {
      e.aiming = false
      e.aimTimer = 0
      e.laser.visible = false
      return
    }
    if (e.fireTimer <= 0) {
      e.aiming = true
      e.aimTimer += dt
      const start = new THREE.Vector3(); e.muzzle.getWorldPosition(start)
      const arr = e.laser.geometry.attributes.position.array
      arr[0] = start.x; arr[1] = start.y; arr[2] = start.z
      arr[3] = playerChest.x + rand(-0.05, 0.05); arr[4] = playerChest.y; arr[5] = playerChest.z + rand(-0.05, 0.05)
      e.laser.geometry.attributes.position.needsUpdate = true
      e.laser.visible = true
      e.laser.material.opacity = 0.25 + Math.min(0.7, e.aimTimer) * 0.6
      if (e.aimTimer > 1.15) {
        this.enemyFire(e, player, dist, true)
        e.aimTimer = 0
        e.fireTimer = rand(e.cfg.fireGap[0], e.cfg.fireGap[1])
        e.aiming = false
        e.laser.visible = false
      }
    }
  }

  enemyFire(e, player, dist, sniper = false) {
    const origin = new THREE.Vector3()
    e.muzzle.getWorldPosition(origin)
    const chest = player.cameraPos.clone().add(new THREE.Vector3(0, -0.25, 0))
    const target = chest.clone()
    const moving = player.speed > 3
    const accuracy = e.cfg.accuracy * (moving ? 0.65 : 1) * (player.crouching ? 0.85 : 1) * clamp(1.15 - dist / 55, 0.3, 1.15)
    const hit = Math.random() < accuracy
    if (!hit) {
      const off = new THREE.Vector3(rand(-1.6, 1.6), rand(-0.9, 1.4), rand(-1.6, 1.6))
      target.add(off)
    }
    const dir = target.clone().sub(origin).normalize()
    // do not shoot through walls
    this.raycaster.set(origin, dir)
    this.raycaster.far = origin.distanceTo(target)
    const wall = this.raycaster.intersectObjects(this.world.raycastTargets, true)
    const end = wall.length ? wall[0].point : target
    this.effects.tracer(origin, end, sniper ? 0xffdfb0 : 0xff8a55, sniper ? 0.85 : 0.55)
    this.effects.muzzleFlash(origin, dir, e.cfg.heavy ? 1.2 : 0.75)
    const pan = this.panFor(origin, player)
    this.audio.enemyShot(dist, pan, e.cfg.heavy)
    if (hit && !wall.length) {
      this.onPlayerDamage?.(sniper ? e.cfg.damage : e.cfg.damage * rand(0.8, 1.2), origin, e)
    }
  }

  panFor(pos, player) {
    const dx = pos.x - player.pos.x
    const dz = pos.z - player.pos.z
    // player's right vector from yaw
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw)
    const d = Math.hypot(dx, dz) || 1
    return clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8
  }

  clearLasers() {
    for (const e of this.enemies) { e.laser.visible = false; e.laser.material.opacity = 0 }
  }

  clear() {
    for (const e of this.enemies) {
      this.scene.remove(e.root); this.scene.remove(e.laser)
      disposeGroup(e.root)
      e.laser.geometry.dispose(); e.laser.material.dispose()
    }
    this.enemies.length = 0
    for (const p of this.projectiles) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose() }
    this.projectiles.length = 0
  }

  minimapData() {
    return this.enemies.filter(e => !e.dead).map(e => ({ x: e.root.position.x, z: e.root.position.z, alerted: e.alerted, boss: e.cfg.boss }))
  }
}
