import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createWorld, ARENA } from './world.js'
import { Effects } from './effects.js'
import { WeaponSystem } from './weapon.js'
import { EnemySystem } from './enemies.js'
import { HUD } from './hud.js'
import { AudioEngine } from './audio.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt))
const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
const TAU = Math.PI * 2

const WAVES = [
  { grunt: 4 },
  { grunt: 6 },
  { grunt: 4, rusher: 2 },
  { grunt: 5, sniper: 2 },
  { grunt: 4, rusher: 2, heavy: 1 },
  { grunt: 6, sniper: 2, rusher: 2 },
  { grunt: 5, rusher: 3, sniper: 2, heavy: 1 },
  { boss: 1, grunt: 4, sniper: 2 },
]

const FinalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    damage: { value: 0 },
    lowHealth: { value: 0 },
    fade: { value: 0 },
    flash: { value: 0 },
    exposure: { value: 1.28 },
    saturation: { value: 1.08 },
    contrast: { value: 1.04 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time, damage, lowHealth, fade, flash, exposure, saturation, contrast;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d,d);
      float ca = 0.0006 + damage * 0.0035 + lowHealth * 0.0012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      vec2 texel = 1.0 / resolution;
      vec3 l = texture2D(tDiffuse, uv - vec2(texel.x,0.0)).rgb;
      vec3 r = texture2D(tDiffuse, uv + vec2(texel.x,0.0)).rgb;
      vec3 u = texture2D(tDiffuse, uv + vec2(0.0,texel.y)).rgb;
      vec3 dn = texture2D(tDiffuse, uv - vec2(0.0,texel.y)).rgb;
      float edge = abs(luma(l)-luma(r)) + abs(luma(u)-luma(dn));
      vec3 blur = (l + r + u + dn + col) * 0.2;
      col = mix(col, blur, smoothstep(0.06, 0.4, edge) * 0.34);
      col = aces(col * exposure);
      float lm = luma(col);
      col += vec3(-0.012, 0.008, 0.026) * (1.0 - lm) * 0.55;
      col += vec3(0.022, 0.008, -0.016) * lm * 0.6;
      col = mix(vec3(lm), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      float vig = smoothstep(1.02, 0.28, length(d) * 1.22);
      col *= mix(0.58, 1.0, vig);
      float grain = hash(uv * resolution + fract(time) * 161.0);
      col += (grain - 0.5) * 0.032;
      float edgeMask = smoothstep(0.18, 0.78, length(d));
      col = mix(col, vec3(col.r * 1.34, col.g * 0.35, col.b * 0.3), damage * 0.72 * edgeMask);
      col = mix(col, vec3(col.r * 0.9, col.g * 0.2, col.b * 0.18), lowHealth * 0.38 * edgeMask);
      col += vec3(1.0, 0.93, 0.82) * flash;
      col *= (1.0 - fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
}

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene')
    this.hud = new HUD()
    this.audio = new AudioEngine()
    this.clock = new THREE.Clock()
    this.time = 0
    this.mode = 'menu'
    this.software = false
    this.quality = localStorage.getItem('zerohour.quality') || 'cinematic'
    this.sensitivity = Number(localStorage.getItem('zerohour.sens') || 1)
    this.invertY = localStorage.getItem('zerohour.invert') === '1'
    this.muted = localStorage.getItem('zerohour.muted') === '1'
    this.touchMode = false
    this.touchAds = false
    this.crouchToggle = false
    this.keys = new Set()
    this.fireHeld = false
    this.adsHeld = false
    this.jumpQueued = false
    this.dragLook = false
    this.lastMouse = { x: 0, y: 0 }
    this.lookPointer = null
    this.stickPointer = null
    this.touchMove = new THREE.Vector2()
    this.mouseDX = 0
    this.mouseDY = 0
    this.recoilAccum = new THREE.Vector2()
    this.shake = 0
    this.fade = 0
    this.damageGrade = 0
    this.flashGrade = 0
    this.thunderTimer = 18 + Math.random() * 20
    this.resultsShown = false
    this.best = Number(localStorage.getItem('zerohour.best') || 0)

    this.initRenderer()
    this.world = createWorld(this.renderer)
    this.scene = this.world.scene
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.06, 420)
    this.camera.rotation.order = 'YXZ'
    this.effects = new Effects(this.scene, this.world, this.camera)
    this.effects.onShake = (amount) => this.addShake(amount)
    this.weapon = new WeaponSystem(this.renderer, this.audio, this.world.environment)
    this.enemies = new EnemySystem(this.scene, this.world, this.effects, this.audio)
    this.enemies.onPlayerDamage = (amount, pos, enemy) => this.takeDamage(amount, pos, enemy)
    this.enemies.onKill = (enemy, info) => this.onEnemyKilled(enemy, info)
    this.audio.setMuted(this.muted)

    this.player = {
      pos: this.world.playerSpawn.clone(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
      health: 100, armor: 50, grounded: true, crouching: false, sprinting: false,
      eye: 1.62, crouchAmount: 0, speed: 0, cameraPos: new THREE.Vector3(),
      radius: 0.36, height: 1.8, stepPhase: 0, lastDamage: -99, deathRoll: 0,
    }
    this.grenades = 2
    this.score = 0
    this.kills = 0
    this.combo = 1
    this.comboTimer = 0
    this.wave = 0
    this.totalWaves = WAVES.length
    this.waveState = 'idle'
    this.spawnQueue = []
    this.spawnTimer = 0
    this.intermissionT = 0
    this.grenadesLive = []
    this.pickups = []
    this.runStart = 0
    this.resultTimer = 0
    this.menuAngle = 0
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = 130
    this.aimDir = new THREE.Vector3()
    this.tmpV = new THREE.Vector3()
    this.tmpV2 = new THREE.Vector3()
    this.tmpV3 = new THREE.Vector3()
    this.forward = new THREE.Vector3()
    this.right = new THREE.Vector3()
    this.up = new THREE.Vector3(0, 1, 0)

    this.initPost()
    this.initInput()
    this.initMenu()
    this.applyQuality(this.quality)
    this.applyTouchMode()
    this.resize()
    window.addEventListener('resize', () => { this.resize(); this.applyTouchMode() })

    this.hud.setSoundMuted(this.muted)
    this.hud.setBest(this.best)
    this.weapon.visible = false
    this.camera.position.set(12, 7, 20)
    this.camera.lookAt(0, 1.4, 0)
    this.player.cameraPos.copy(this.camera.position)
    this.last = performance.now()
    this.hud.bootDone()
    requestAnimationFrame(this.animate.bind(this))
  }

  initRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false })
    } catch (err) {
      this.hud.showError('WebGL could not be initialized on this device. Try a browser with hardware acceleration enabled.')
      throw err
    }
    const gl = this.renderer.getContext()
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    this.software = /swiftshader|llvmpipe|software|angle \(google/i.test(name)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    this.renderer.setSize(innerWidth, innerHeight, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.autoClear = false
    this.rendererName = name
  }

  initPost() {
    this.composer = new EffectComposer(this.renderer)
    this.mainPass = new RenderPass(this.scene, this.camera)
    this.vmPass = new RenderPass(this.weapon.scene, this.weapon.camera)
    this.vmPass.clear = false
    this.vmPass.clearDepth = true
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.56, 0.72, 0.62)
    this.grade = new ShaderPass(FinalGradeShader)
    this.grade.uniforms.resolution.value.set(innerWidth, innerHeight)
    this.composer.addPass(this.mainPass)
    this.composer.addPass(this.vmPass)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.grade)
    this.composer.setSize(innerWidth, innerHeight)
  }

  initMenu() {
    const $ = id => document.getElementById(id)
    $('btn-play').addEventListener('click', () => { this.audio.init(); this.audio.ui(); this.startRun() })
    $('btn-retry').addEventListener('click', () => { this.audio.ui(); this.startRun() })
    $('btn-return-menu').addEventListener('click', () => { this.audio.ui(); this.returnToMenu() })
    $('btn-resume').addEventListener('click', () => this.resume())
    $('btn-restart').addEventListener('click', () => { this.audio.ui(); this.startRun() })
    $('btn-abort').addEventListener('click', () => { this.audio.ui(); this.returnToMenu() })
    $('btn-pause').addEventListener('click', () => this.pause())
    $('btn-controls').addEventListener('click', () => { this.audio.ui(); $('controls-modal').classList.remove('hidden') })
    $('btn-controls-close').addEventListener('click', () => { this.audio.ui(); $('controls-modal').classList.add('hidden') })
    $('btn-settings').addEventListener('click', () => { this.audio.ui(); this.openSettings() })
    $('btn-pause-settings').addEventListener('click', () => { this.audio.ui(); this.openSettings() })
    $('btn-settings-close').addEventListener('click', () => { this.audio.ui(); this.closeSettings() })
    const toggleSound = () => {
      this.audio.init()
      this.muted = !this.muted
      this.audio.setMuted(this.muted)
      this.hud.setSoundMuted(this.muted)
      this.audio.ui()
    }
    $('btn-sound').addEventListener('click', toggleSound)
    $('btn-menu-sound').addEventListener('click', toggleSound)

    const sens = $('set-sens'), vol = $('set-vol'), invert = $('set-invert')
    sens.value = this.sensitivity
    vol.value = Math.round(this.audio.volume * 100)
    invert.checked = this.invertY
    $('sens-value').textContent = Number(this.sensitivity).toFixed(2)
    $('vol-value').textContent = vol.value
    sens.addEventListener('input', () => {
      this.sensitivity = Number(sens.value)
      $('sens-value').textContent = this.sensitivity.toFixed(2)
      localStorage.setItem('zerohour.sens', this.sensitivity)
    })
    vol.addEventListener('input', () => {
      this.audio.setVolume(Number(vol.value) / 100)
      $('vol-value').textContent = vol.value
      localStorage.setItem('zerohour.vol', vol.value)
    })
    invert.addEventListener('change', () => {
      this.invertY = invert.checked
      localStorage.setItem('zerohour.invert', this.invertY ? '1' : '0')
    })
    const savedVol = Number(localStorage.getItem('zerohour.vol') || 60)
    this.audio.setVolume(savedVol / 100)
    $('vol-value').textContent = savedVol
    vol.value = savedVol
    document.querySelectorAll('#quality-group button').forEach(b => {
      b.addEventListener('click', () => { this.applyQuality(b.dataset.quality); this.audio.ui() })
    })
    this.syncQualityButtons()
    document.getElementById('settings-modal').addEventListener('click', e => {
      if (e.target.id === 'settings-modal') this.closeSettings()
    })
    document.getElementById('controls-modal').addEventListener('click', e => {
      if (e.target.id === 'controls-modal') document.getElementById('controls-modal').classList.add('hidden')
    })
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        const controls = document.getElementById('controls-modal')
        const settings = document.getElementById('settings-modal')
        if (!controls.classList.contains('hidden')) { controls.classList.add('hidden'); return }
        if (!settings.classList.contains('hidden')) { this.closeSettings(); return }
      }
    })
  }

  openSettings() {
    document.getElementById('set-sens').value = this.sensitivity
    document.getElementById('sens-value').textContent = this.sensitivity.toFixed(2)
    document.getElementById('set-invert').checked = this.invertY
    this.syncQualityButtons()
    document.getElementById('settings-modal').classList.remove('hidden')
    this.wasPausedForSettings = this.mode === 'paused'
  }
  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden')
  }
  syncQualityButtons() {
    document.querySelectorAll('#quality-group button').forEach(b => b.classList.toggle('active', b.dataset.quality === this.quality))
  }

  applyQuality(q) {
    this.quality = q
    localStorage.setItem('zerohour.quality', q)
    const config = {
      cinematic: { dpr: 1.6, shadows: true, size: 2048, bloom: true },
      balanced: { dpr: 1.15, shadows: true, size: 1024, bloom: true },
      performance: { dpr: 0.85, shadows: false, size: 512, bloom: false },
    }[q] || { dpr: 1.15, shadows: true, size: 1024, bloom: true }
    let dpr = Math.min(devicePixelRatio || 1, config.dpr)
    if (this.software) dpr = Math.min(dpr, 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.shadowMap.enabled = config.shadows
    this.renderer.shadowMap.needsUpdate = true
    if (this.world) {
      this.world.moonLight.castShadow = config.shadows
      if (this.world.moonLight.shadow.mapSize.x !== config.size) {
        this.world.moonLight.shadow.mapSize.set(config.size, config.size)
        if (this.world.moonLight.shadow.map) { this.world.moonLight.shadow.map.dispose(); this.world.moonLight.shadow.map = null }
      }
    }
    if (this.composer) {
      this.composer.setPixelRatio(dpr)
      this.composer.setSize(innerWidth, innerHeight)
    }
    if (this.bloom) this.bloom.enabled = config.bloom
    if (this.scene) this.scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true })
    this.syncQualityButtons()
  }

  resize() {
    const w = innerWidth, h = innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.weapon.setAspect(w / h)
    this.composer?.setSize(w, h)
    this.bloom?.setSize(w, h)
    this.grade?.uniforms.resolution.value.set(w, h)
  }

  applyTouchMode() {
    const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    const touch = coarse || innerWidth < 720
    if (touch !== this.touchMode) {
      this.touchMode = touch
      document.body.classList.toggle('touch', touch)
    }
    this.hud.setTouchVisible(this.touchMode && (this.mode === 'playing' || this.mode === 'paused'))
  }

  initInput() {
    const canvas = this.canvas
    document.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      this.keys.add(e.code)
      if (this.mode !== 'playing') {
        if (e.code === 'Escape' && this.mode === 'paused') this.resume()
        return
      }
      if (e.code === 'Escape') { this.pause(); return }
      if (e.code === 'KeyR') this.weapon.reload()
      if (e.code === 'KeyF') this.doMelee()
      if (e.code === 'KeyG') this.throwGrenade()
      if (e.code === 'Space') this.jumpQueued = true
      if (e.code === 'Digit1') this.weapon.switchTo(0)
      if (e.code === 'Digit2') this.weapon.switchTo(1)
      if (e.code === 'KeyQ') this.weapon.nextWeapon()
    })
    document.addEventListener('keyup', e => { this.keys.delete(e.code) })
    window.addEventListener('blur', () => { this.fireHeld = false; if (this.mode === 'playing') this.pause() })
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'playing') this.pause() })

    canvas.addEventListener('contextmenu', e => e.preventDefault())
    canvas.addEventListener('mousedown', e => {
      if (this.mode !== 'playing') return
      this.audio.init()
      if (e.button === 2) { this.adsHeld = true; return }
      if (e.button !== 0) return
      if (document.pointerLockElement !== canvas && !this.touchMode) {
        this.requestLock()
        this.dragLook = true
        return
      }
      this.fireHeld = true
    })
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.fireHeld = false
      if (e.button === 2) this.adsHeld = false
    })
    document.addEventListener('mousemove', e => {
      if (this.mode !== 'playing') return
      const locked = document.pointerLockElement === canvas
      if (!locked && !this.dragLook) return
      const dx = e.movementX || 0, dy = e.movementY || 0
      this.applyLook(dx, dy, 0.0021)
      this.mouseDX += dx; this.mouseDY += dy
    })
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas
      if (locked) { this.dragLook = false; this.hud.setReticleHint(false) }
      else if (this.mode === 'playing' && !this.ignoreUnlock) {
        this.hud.setReticleHint(true)
        this.pause()
      }
    })
    document.addEventListener('pointerlockerror', () => {
      this.dragLook = true
      this.hud.setReticleHint(true)
    })

    // touch look
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || this.mode !== 'playing') return
      this.audio.init()
      this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !this.lookPointer || e.pointerId !== this.lookPointer.id || this.mode !== 'playing') return
      const dx = e.clientX - this.lookPointer.x
      const dy = e.clientY - this.lookPointer.y
      this.lookPointer.x = e.clientX; this.lookPointer.y = e.clientY
      this.applyLook(dx, dy, 0.0042)
      this.mouseDX += dx; this.mouseDY += dy
    })
    const endLook = e => {
      if (this.lookPointer && e.pointerId === this.lookPointer.id) this.lookPointer = null
    }
    canvas.addEventListener('pointerup', endLook)
    canvas.addEventListener('pointercancel', endLook)

    this.initTouchControls()
  }

  initTouchControls() {
    const $ = id => document.getElementById(id)
    const zone = $('stick-zone'), knob = $('stick-knob')
    const resetStick = () => {
      this.stickPointer = null
      this.touchMove.set(0, 0)
      knob.style.transform = 'translate(0px, 0px)'
    }
    zone.addEventListener('pointerdown', e => {
      if (!this.touchMode || this.mode !== 'playing') return
      e.preventDefault(); e.stopPropagation()
      this.audio.init()
      this.stickPointer = e.pointerId
      zone.setPointerCapture(e.pointerId)
      this.updateStick(e, zone, knob)
    })
    zone.addEventListener('pointermove', e => {
      if (this.stickPointer !== e.pointerId) return
      e.preventDefault()
      this.updateStick(e, zone, knob)
    })
    zone.addEventListener('pointerup', e => { if (this.stickPointer === e.pointerId) resetStick() })
    zone.addEventListener('pointercancel', resetStick)

    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down?.(); el.classList.add('on') })
      el.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); up?.(); el.classList.remove('on') })
      el.addEventListener('pointercancel', () => { up?.(); el.classList.remove('on') })
      el.addEventListener('pointerleave', e => { if (e.buttons) return; up?.(); el.classList.remove('on') })
    }
    hold($('t-fire'), () => { this.audio.init(); this.fireHeld = true }, () => { this.fireHeld = false })
    $('t-ads').addEventListener('pointerdown', e => { e.preventDefault(); this.touchAds = !this.touchAds; $('t-ads').classList.toggle('on', this.touchAds) })
    $('t-reload').addEventListener('pointerdown', e => { e.preventDefault(); this.weapon.reload(); $('t-reload').classList.add('on'); setTimeout(() => $('t-reload').classList.remove('on'), 150) })
    $('t-jump').addEventListener('pointerdown', e => { e.preventDefault(); this.jumpQueued = true; $('t-jump').classList.add('on'); setTimeout(() => $('t-jump').classList.remove('on'), 150) })
    $('t-crouch').addEventListener('pointerdown', e => {
      e.preventDefault(); this.crouchToggle = !this.crouchToggle
      $('t-crouch').classList.toggle('on', this.crouchToggle)
    })
    $('t-grenade').addEventListener('pointerdown', e => { e.preventDefault(); this.throwGrenade(); $('t-grenade').classList.add('on'); setTimeout(() => $('t-grenade').classList.remove('on'), 150) })
    $('t-swap').addEventListener('pointerdown', e => { e.preventDefault(); this.weapon.nextWeapon(); $('t-swap').classList.add('on'); setTimeout(() => $('t-swap').classList.remove('on'), 150) })
  }

  updateStick(e, zone, knob) {
    const r = zone.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    let dx = (e.clientX - cx) / (r.width * 0.36)
    let dy = (e.clientY - cy) / (r.height * 0.36)
    const len = Math.hypot(dx, dy)
    if (len > 1) { dx /= len; dy /= len }
    this.touchMove.set(dx, dy)
    knob.style.transform = `translate(${dx * 44}px, ${dy * 44}px)`
  }

  applyLook(dx, dy, base) {
    const sens = this.sensitivity * base * lerp(1, 0.62, this.weapon.adsAmount)
    this.player.yaw -= dx * sens
    const inv = this.invertY ? -1 : 1
    this.player.pitch -= dy * sens * inv
    this.player.pitch = clamp(this.player.pitch, -1.47, 1.47)
    if (this.player.yaw > Math.PI) this.player.yaw -= TAU
    if (this.player.yaw < -Math.PI) this.player.yaw += TAU
  }

  requestLock() {
    this.audio.init()
    this.ignoreUnlock = false
    try {
      const p = this.canvas.requestPointerLock?.()
      if (p && p.catch) p.catch(() => { this.dragLook = true; this.hud.setReticleHint(true) })
    } catch { this.dragLook = true }
  }

  startRun() {
    this.audio.init()
    this.enemies.clear()
    this.clearPickups()
    this.clearGrenades()
    this.hud.hideResults()
    document.getElementById('pause').classList.add('hidden')
    this.player.pos.copy(this.world.playerSpawn)
    this.player.pos.y = 0
    this.player.vel.set(0, 0, 0)
    this.player.yaw = 0
    this.player.pitch = 0
    this.player.health = 100
    this.player.armor = 50
    this.player.crouching = false
    this.player.crouchAmount = 0
    this.player.lastDamage = -99
    this.player.deathRoll = 0
    this.grenades = 2
    this.score = 0
    this.kills = 0
    this.combo = 1
    this.comboTimer = 0
    this.wave = 0
    this.waveState = 'idle'
    this.spawnQueue.length = 0
    this.intermissionT = 0
    this.resultsShown = false
    this.runStart = this.time
    this.weapon.reset()
    this.weapon.visible = true
    this.fireHeld = false
    this.adsHeld = false
    this.touchAds = false
    this.crouchToggle = false
    this.fade = 0.85
    this.damageGrade = 0
    this.mode = 'playing'
    this.hud.setMenuVisible(false)
    this.hud.setHudVisible(true)
    this.hud.setTouchVisible(this.touchMode)
    this.hud.setReticleHint(!this.touchMode)
    document.body.classList.add('playing')
    this.applyQuality(this.quality)
    this.requestLock()
    this.startWave(1)
    this.hud.notify('<b>MISSION START</b> // HOLD THE LINE', 2600)
  }

  returnToMenu() {
    this.ignoreUnlock = true
    if (document.pointerLockElement) document.exitPointerLock()
    this.enemies.clear()
    this.clearPickups()
    this.clearGrenades()
    this.hud.hideResults()
    this.hud.showPause(false)
    this.hud.setHudVisible(false)
    this.hud.setTouchVisible(false)
    this.hud.setMenuVisible(true)
    this.hud.setReticleHint(false)
    document.body.classList.remove('playing')
    this.mode = 'menu'
    this.weapon.visible = false
    this.fireHeld = false
    this.adsHeld = false
    this.touchAds = false
    this.fade = 0.4
    this.audio.setIntensity(0)
    this.camera.fov = 62
    this.camera.updateProjectionMatrix()
    this.menuAngle = this.time * 0.035
  }

  pause() {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.fireHeld = false
    this.adsHeld = false
    this.ignoreUnlock = true
    if (document.pointerLockElement) document.exitPointerLock()
    this.hud.showPause(true, this.hudState())
    this.hud.setTouchVisible(false)
    this.hud.setReticleHint(false)
  }

  resume() {
    if (this.mode !== 'paused') return
    document.getElementById('pause').classList.add('hidden')
    document.getElementById('settings-modal').classList.add('hidden')
    this.mode = 'playing'
    this.hud.setTouchVisible(this.touchMode)
    if (this.touchMode) this.ignoreUnlock = true
    else this.requestLock()
    this.hud.setReticleHint(!this.touchMode)
  }

  hudState() {
    return {
      health: this.player.health,
      armor: this.player.armor,
      grenades: this.grenades,
      score: this.score,
      combo: this.combo,
      wave: this.wave || 1,
      totalWaves: this.totalWaves,
      enemiesLeft: this.enemiesRemaining(),
      objective: this.objectiveText(),
      weapon: this.weapon.getState(),
      spread: this.weapon.getSpread(this.player.speed > 1),
      heading: ((-this.player.yaw * 180 / Math.PI) % 360 + 360) % 360,
      world: this.world,
      pickups: this.pickups.map(p => ({ x: p.mesh.position.x, z: p.mesh.position.z, type: p.type })),
      enemies: this.enemies.minimapData(),
      player: { x: this.player.pos.x, z: this.player.pos.z },
      yaw: -this.player.yaw,
      boss: this.enemies.getBoss(),
      kills: this.kills,
    }
  }

  enemyRemainingCount() { return this.spawnQueue.length + this.enemies.aliveCount() }
  enemiesRemaining() { return this.enemyRemainingCount() }
  objectiveText() {
    if (this.waveState === 'intermission') return 'REGROUP // RESUPPLY'
    if (this.wave >= this.totalWaves && this.enemies.getBoss()) return 'NEUTRALIZE THE WARDEN'
    return 'HOLD THE LINE'
  }

  startWave(n) {
    this.wave = n
    this.waveState = 'active'
    this.spawnQueue = []
    const wave = WAVES[n - 1]
    for (const [type, count] of Object.entries(wave)) for (let i = 0; i < count; i++) this.spawnQueue.push(type)
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]]
    }
    if (wave.boss) {
      const idx = this.spawnQueue.indexOf('boss')
      if (idx >= 0) { this.spawnQueue.splice(idx, 1); this.spawnQueue.splice(Math.min(2, this.spawnQueue.length), 0, 'boss') }
    }
    this.spawnTimer = 0.5
    const total = Object.values(wave).reduce((a, b) => a + b, 0)
    this.hud.showBanner(`WAVE ${String(n).padStart(2, '0')}`, `${total} HOSTILE${total > 1 ? 'S' : ''} INBOUND`, 'INCOMING')
    this.hud.notify(n === this.totalWaves ? '<b>FINAL WAVE</b> // WARDEN ON SITE' : `WAVE ${String(n).padStart(2, '0')} // WEAPONS FREE`, 2200)
    this.audio.waveStart(n)
  }

  spawnNext() {
    const type = this.spawnQueue.shift()
    const playerPos = this.player.pos
    let candidates = this.world.enemySpawnPoints.filter(p => p.distanceTo(playerPos) > 16)
    if (!candidates.length) candidates = this.world.enemySpawnPoints
    const pos = candidates[Math.floor(Math.random() * candidates.length)].clone()
    pos.x += rand(-1.4, 1.4); pos.z += rand(-1.4, 1.4)
    this.enemies.spawn(type, pos)
    this.spawnTimer = this.wave <= 2 ? 1.1 : 0.72
  }

  updateWaves(dt) {
    if (this.waveState === 'active') {
      if (this.spawnQueue.length && this.spawnTimer <= 0) {
        const maxAlive = this.wave >= 8 ? 10 : this.wave >= 5 ? 9 : 7
        if (this.enemies.aliveCount() < maxAlive) this.spawnNext()
      }
      this.spawnTimer -= dt
      if (!this.spawnQueue.length && this.enemies.aliveCount() === 0) this.onWaveClear()
    } else if (this.waveState === 'intermission') {
      this.intermissionT -= dt
      if (this.intermissionT <= 0) this.startWave(this.wave + 1)
    }
  }

  onWaveClear() {
    if (this.wave >= this.totalWaves) { this.finishRun(true); return }
    this.waveState = 'intermission'
    this.intermissionT = 7
    this.score += 500 * this.wave
    this.weapon.addAmmo(0.55)
    this.grenades = Math.min(3, this.grenades + 1)
    this.player.health = Math.min(100, this.player.health + 30)
    this.player.armor = Math.min(100, this.player.armor + 25)
    this.hud.showBanner(`WAVE ${String(this.wave).padStart(2, '0')} CLEARED`, 'RESUPPLY IN 7 SECONDS', 'SECTOR CLEAR')
    this.hud.notify('<b>RESUPPLIED</b> // AMMO + FRAG + ARMOR', 2400)
    this.audio.waveClear()
  }

  updatePlayer(dt) {
    const p = this.player
    const crouch = this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC') || this.crouchToggle
    p.crouching = crouch
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const ads = this.adsHeld || this.touchAds
    const wantSprint = sprint && !crouch && !ads && (this.keys.has('KeyW') || this.touchMove.y < -0.3)
    p.sprinting = wantSprint

    let f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.touchMove.y
    let r = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touchMove.x
    const len = Math.hypot(f, r)
    if (len > 1) { f /= len; r /= len }
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw)
    const moveX = (-sin * f + cos * r)
    const moveZ = (-cos * f - sin * r)
    let targetSpeed = crouch ? 2.35 : wantSprint ? 7.4 : 4.7
    if (ads) targetSpeed *= 0.62
    const accel = p.grounded ? 14 : 3.2
    p.vel.x = damp(p.vel.x, moveX * targetSpeed, accel, dt)
    p.vel.z = damp(p.vel.z, moveZ * targetSpeed, accel, dt)
    if (Math.abs(moveX) < 0.01 && Math.abs(moveZ) < 0.01) {
      p.vel.x = damp(p.vel.x, 0, p.grounded ? 13 : 0.8, dt)
      p.vel.z = damp(p.vel.z, 0, p.grounded ? 13 : 0.8, dt)
    }

    p.crouchAmount = damp(p.crouchAmount, crouch ? 1 : 0, 12, dt)
    const height = lerp(1.8, 1.24, p.crouchAmount)
    const eyeTarget = lerp(1.62, 1.06, p.crouchAmount)
    p.height = height

    if (this.jumpQueued) {
      this.jumpQueued = false
      if (p.grounded && !crouch) { p.vel.y = 5.5; p.grounded = false }
    }
    this.jumpQueued = false

    const radius = p.radius
    const feet = p.pos.y
    const tryX = p.pos.x + p.vel.x * dt
    if (tryX > ARENA.minX + radius && tryX < ARENA.maxX - radius) {
      const gh = this.world.groundHeightAt(tryX, p.pos.z)
      if (gh <= feet + 0.52 && !this.world.colliderAt(tryX, p.pos.z, radius, feet, height)) p.pos.x = tryX
      else p.vel.x = 0
    } else p.vel.x = 0
    const tryZ = p.pos.z + p.vel.z * dt
    if (tryZ > ARENA.minZ + radius && tryZ < ARENA.maxZ - radius) {
      const gh = this.world.groundHeightAt(p.pos.x, tryZ)
      if (gh <= feet + 0.52 && !this.world.colliderAt(p.pos.x, tryZ, radius, feet, height)) p.pos.z = tryZ
      else p.vel.z = 0
    } else p.vel.z = 0

    // vertical
    p.vel.y -= 18.5 * dt
    p.pos.y += p.vel.y * dt
    const gh = this.world.groundHeightAt(p.pos.x, p.pos.z)
    if (p.pos.y <= gh) {
      if (!p.grounded && p.vel.y < -4) { this.landKick = 1; this.effects.shake = Math.max(this.effects.shake, 0.15) }
      p.pos.y = gh
      p.vel.y = 0
      p.grounded = true
    } else if (p.pos.y > gh + 0.02) p.grounded = false
    if (p.grounded) {
      const g2 = this.world.groundHeightAt(p.pos.x, p.pos.z)
      if (g2 <= p.pos.y + 0.52 && g2 >= p.pos.y - 0.55) p.pos.y = g2
      else if (g2 < p.pos.y - 0.55) p.grounded = false
    }
    this.world.boundsClamp(p.pos, radius)

    // bob + footsteps
    p.speed = Math.hypot(p.vel.x, p.vel.z)
    const moving = p.speed > 0.8
    if (moving && p.grounded) {
      const rate = wantSprint ? 11.5 : 8.2
      p.stepPhase += dt * rate * clamp(p.speed / 4.7, 0.5, 1.5)
      const step = Math.floor(p.stepPhase / Math.PI)
      if (step !== this.lastStep) { this.lastStep = step; this.audio.footstep(wantSprint) }
    }
    p.eye = damp(p.eye, eyeTarget, 10, dt)
    const bobAmt = moving && p.grounded ? clamp(p.speed / 7, 0, 1) * (1 - this.weapon.adsAmount * 0.85) : 0
    const bobY = Math.sin(p.stepPhase * 2) * 0.035 * bobAmt
    const bobX = Math.cos(p.stepPhase) * 0.022 * bobAmt
    const strafeRoll = clamp((r * -1) * 0.02 + (this.mouseDX * 0.000015), -0.04, 0.04)
    this.mouseDX = 0; this.mouseDY = 0

    const recoil = this.weapon.consumeRecoil()
    this.recoilAccum.x += recoil.pitch
    this.recoilAccum.y += recoil.yaw
    this.recoilAccum.x = damp(this.recoilAccum.x, 0, 9, dt)
    this.recoilAccum.y = damp(this.recoilAccum.y, 0, 9, dt)

    this.shake = Math.max(0, this.shake - dt * 2.8)
    const shakeAmt = this.shake * 0.011
    const shakeX = (Math.random() - 0.5) * shakeAmt
    const shakeY = (Math.random() - 0.5) * shakeAmt
    const shakeRoll = (Math.random() - 0.5) * shakeAmt * 0.9
    this.camera.position.set(
      p.pos.x + bobX + (Math.random() - 0.5) * this.shake * 0.018,
      p.pos.y + p.eye + bobY,
      p.pos.z + (Math.random() - 0.5) * this.shake * 0.018
    )
    this.camera.rotation.set(
      p.pitch + this.recoilAccum.x + shakeX,
      p.yaw + this.recoilAccum.y + shakeY,
      strafeRoll + shakeRoll
    )
    p.cameraPos.copy(this.camera.position)

    // health regen
    if (this.time - p.lastDamage > 6 && p.health < 100 && this.mode === 'playing') {
      p.health = Math.min(100, p.health + 11 * dt)
    }

    const input = {
      time: this.time, speed: p.speed, sprinting: wantSprint, crouch: p.crouching,
      grounded: p.grounded, adsHeld: ads, fireHeld: this.fireHeld,
      mouseDX: this.mouseDX, mouseDY: this.mouseDY, moving,
    }
    this.weapon.adsHeld = ads
    this.weapon.update(dt, input)
    this.weapon.camera.fov = this.weapon.currentFov + (wantSprint ? 5 : 0)
    this.weapon.camera.updateProjectionMatrix()
    this.camera.fov = this.weapon.currentFov + (wantSprint ? 5 : 0)
    this.camera.updateProjectionMatrix()

    if (this.weapon.shotThisFrame) this.shoot()
    if (this.weapon.consumeMeleeHit()) this.meleeDamage()
  }

  shoot() {
    const def = this.weapon.def
    const origin = new THREE.Vector3().copy(this.camera.position)
    this.camera.getWorldDirection(this.forward)
    this.right.crossVectors(this.forward, this.up).normalize()
    this.tmpV3.crossVectors(this.right, this.forward).normalize()
    const spread = this.weapon.getSpread(this.player.speed > 1)
    const a = Math.random() * TAU
    const rad = Math.sqrt(Math.random()) * spread
    const dir = this.forward.clone().addScaledVector(this.right, Math.cos(a) * rad).addScaledVector(this.tmpV3, Math.sin(a) * rad).normalize()

    this.raycaster.set(origin, dir)
    this.raycaster.far = def.range
    const worldHits = this.raycaster.intersectObjects(this.world.raycastTargets, true)
    const wHit = worldHits[0]
    const eHit = this.enemies.raycast(origin, dir, def.range)
    const muzzle = this.camera.position.clone().addScaledVector(this.forward, 0.5).addScaledVector(this.right, 0.13).addScaledVector(this.tmpV3, -0.11)
    this.effects.muzzleFlash(muzzle, this.forward, 1)
    this.audio.shot(def.kind)

    let end = origin.clone().addScaledVector(dir, def.range)
    if (eHit && (!wHit || eHit.distance < wHit.distance)) {
      end = eHit.point.clone()
      const result = this.enemies.damage(eHit.enemy, def.damage, eHit.zone, eHit.point, dir)
      this.hits = (this.hits || 0) + 1
      this.weapon.shotsHit++
      this.hud.hit(result.dead ? 'kill' : result.headshot ? 'head' : 'body')
      this.audio.hit(result.headshot, result.dead)
      this.effects.impact(eHit.point, dir.clone().negate(), { metal: false, force: 0.5 })
    } else if (wHit) {
      end = wHit.point.clone()
      let normal = new THREE.Vector3(0, 1, 0)
      if (wHit.face) normal.copy(wHit.face.normal).transformDirection(wHit.object.matrixWorld).normalize()
      this.effects.impact(wHit.point, normal, { metal: Math.random() > 0.5, force: 1 })
    }
    this.effects.tracer(muzzle, end, 0xffd8a0, 0.72)
    this.effects.casing(this.camera.position.clone().addScaledVector(this.right, 0.2).addScaledVector(this.tmpV3, -0.18), this.right)
    this.addShake(0.045)
  }

  doMelee() {
    if (this.weapon.melee()) {
      // damage resolved by consumeMeleeHit in update
    }
  }

  meleeDamage() {
    this.camera.getWorldDirection(this.forward)
    let best = null, bestD = 2.8
    for (const e of this.enemies.enemies) {
      if (e.dead) continue
      const dx = e.root.position.x - this.player.pos.x
      const dz = e.root.position.z - this.player.pos.z
      const d = Math.hypot(dx, dz)
      if (d > bestD) continue
      const dir = new THREE.Vector3(dx, 0, dz).normalize()
      if (dir.dot(this.forward) < 0.25) continue
      best = e; bestD = d
    }
    if (best) {
      const point = new THREE.Vector3(best.root.position.x, best.root.position.y + 1.2, best.root.position.z)
      this.enemies.damage(best, 240, 'body', point, this.forward.clone())
      this.effects.blood(point, this.forward.clone(), 1.3)
      this.hud.hit('kill')
      this.audio.hit(false, true)
      this.addShake(0.14)
    }
  }

  throwGrenade() {
    if (this.mode !== 'playing') return
    if (this.grenades <= 0) { this.hud.notify('<b>NO FRAGS REMAINING</b>', 1300); this.audio.dryFire(); return }
    this.grenades--
    this.audio.grenadeThrow()
    this.camera.getWorldDirection(this.forward)
    const mesh = new THREE.Group()
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2b3328, roughness: 0.55, metalness: 0.45, emissive: 0x22160a, emissiveIntensity: 0.5 }))
    mesh.add(ball)
    const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, color: 0xff5a20, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
    light.visible = false
    mesh.add(light)
    mesh.position.copy(this.camera.position).addScaledVector(this.forward, 0.45)
    mesh.position.y -= 0.15
    const vel = this.forward.clone().multiplyScalar(13).add(new THREE.Vector3(0, 4.2, 0)).addScaledVector(this.right, 1.2)
    this.scene.add(mesh)
    this.grenadesLive.push({ mesh, vel, fuse: 2.4, blink: 0, ball })
    this.hud.notify('<b>FRAG OUT</b>', 900)
  }

  updateGrenades(dt) {
    for (let i = this.grenadesLive.length - 1; i >= 0; i--) {
      const g = this.grenadesLive[i]
      g.fuse -= dt
      g.vel.y -= 16 * dt
      g.mesh.position.addScaledVector(g.vel, dt)
      const gh = this.world.groundHeightAt(g.mesh.position.x, g.mesh.position.z)
      if (g.mesh.position.y < gh + 0.12) {
        g.mesh.position.y = gh + 0.12
        if (Math.abs(g.vel.y) > 1) g.vel.y *= -0.45
        else g.vel.y = 0
        g.vel.x *= 0.7; g.vel.z *= 0.7
      }
      for (const c of this.world.colliders) {
        if (g.mesh.position.x > c.minX - 0.1 && g.mesh.position.x < c.maxX + 0.1 && g.mesh.position.z > c.minZ - 0.1 && g.mesh.position.z < c.maxZ + 0.1 && g.mesh.position.y > c.minY && g.mesh.position.y < c.maxY) {
          g.vel.x *= -0.35; g.vel.z *= -0.35
        }
      }
      g.blink += dt
      g.ball.material.emissiveIntensity = g.fuse < 0.8 ? (Math.sin(g.blink * 30) > 0 ? 3.5 : 0.1) : 0.5
      if (g.fuse <= 0) {
        const pos = g.mesh.position.clone()
        this.effects.explosion(pos, { radius: 7 })
        this.audio.explosion(pos.distanceTo(this.player.pos), 0)
        this.addShake(0.5)
        const radius = 7.5
        for (const e of this.enemies.enemies) {
          if (e.dead) continue
          const d = e.root.position.distanceTo(pos)
          if (d < radius) {
            const dmg = 260 * (1 - d / radius)
            const point = new THREE.Vector3(e.root.position.x, e.root.position.y + 1.2, e.root.position.z)
            this.enemies.damage(e, dmg, 'body', point, point.clone().sub(pos).normalize())
          }
        }
        const pd = this.player.pos.distanceTo(pos)
        if (pd < 6.5) this.takeDamage(42 * (1 - pd / 7.5), pos, null)
        this.scene.remove(g.mesh)
        g.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
        this.grenadesLive.splice(i, 1)
      }
    }
  }

  clearGrenades() {
    for (const g of this.grenadesLive) { this.scene.remove(g.mesh); g.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } }) }
    this.grenadesLive.length = 0
  }

  takeDamage(amount, sourcePos, enemy) {
    if (this.mode !== 'playing' || amount <= 0) return
    const p = this.player
    let dmg = amount
    if (p.armor > 0) {
      const absorb = Math.min(p.armor, dmg * 0.68)
      p.armor -= absorb
      dmg -= absorb
    }
    p.health -= dmg
    p.lastDamage = this.time
    this.damageGrade = Math.min(1, this.damageGrade + amount / 55)
    this.addShake(0.18 + Math.min(0.4, amount / 60))
    this.audio.damage()
    let angle = 0
    if (sourcePos) {
      const dx = sourcePos.x - p.pos.x, dz = sourcePos.z - p.pos.z
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw)
      angle = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
    }
    this.hud.damage(amount, angle)
    if (p.health <= 0) {
      p.health = 0
      this.die()
    } else if (p.health < 35 && !this._heartbeat) {
      this._heartbeat = setInterval(() => {
        if (this.mode === 'playing' && this.player.health < 35) this.audio.heartbeat()
        else { clearInterval(this._heartbeat); this._heartbeat = null }
      }, 1200)
    }
  }

  addShake(amount) { this.shake = Math.min(0.9, this.shake + amount) }

  die() {
    if (this.mode !== 'playing') return
    this.mode = 'dead'
    this.resultTimer = 0
    this.resultsShown = false
    this.fireHeld = false
    this.ignoreUnlock = true
    if (document.pointerLockElement) document.exitPointerLock()
    this.hud.setTouchVisible(false)
    this.hud.setReticleHint(false)
    this.audio.defeat()
    this.audio.setIntensity(0)
    this.hud.showBanner('OPERATOR DOWN', 'SIGNAL LOST', 'KIA')
  }

  finishRun(win) {
    if (this.mode === 'dead' || this.mode === 'victory') return
    this.mode = win ? 'victory' : 'dead'
    this.resultTimer = 0
    this.resultsShown = false
    this.fireHeld = false
    this.ignoreUnlock = true
    if (document.pointerLockElement) document.exitPointerLock()
    this.hud.setTouchVisible(false)
    this.hud.setReticleHint(false)
    if (win) {
      this.audio.victory()
      this.audio.setIntensity(0)
      this.hud.showBanner('SECTOR SECURED', 'WARDEN NEUTRALIZED', 'MISSION COMPLETE')
      this.score += 5000
    } else {
      this.audio.defeat()
    }
  }

  showResults(win) {
    if (this.resultsShown) return
    this.resultsShown = true
    const shots = this.weapon.shotsFired
    const acc = shots ? Math.round(this.weapon.shotsHit / shots * 100) : 0
    const elapsed = Math.max(0, Math.floor(this.time - this.runStart))
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const ss = String(elapsed % 60).padStart(2, '0')
    const best = Math.max(this.best, this.score)
    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem('zerohour.best', String(this.best))
    }
    this.hud.setBest(this.best)
    this.hud.showResults(win, {
      wave: this.wave, kills: this.kills, accuracy: acc, score: this.score,
      best, time: `${mm}:${ss}`,
    })
    this.weapon.visible = false
  }

  onEnemyKilled(enemy, { headshot }) {
    this.kills++
    if (this.comboTimer > 0) this.combo = Math.min(9, this.combo + 1)
    else this.combo = 1
    this.comboTimer = 4
    this.score += Math.floor(enemy.cfg.score * this.combo)
    this.hud.addKill(this.weapon.def.short, headshot, enemy.cfg.boss)
    this.hud.hit(headshot ? 'head' : 'kill')
    this.audio.hit(headshot, true)
    this.spawnDrop(enemy)
  }

  spawnDrop(enemy) {
    const p = enemy.root.position
    if (enemy.cfg.boss) {
      this.spawnPickup(new THREE.Vector3(p.x + 1.2, 0, p.z), 'health')
      this.spawnPickup(new THREE.Vector3(p.x - 1.2, 0, p.z), 'armor')
      this.spawnPickup(new THREE.Vector3(p.x, 0, p.z + 1.2), 'ammo')
      return
    }
    if (Math.random() > enemy.cfg.drop) return
    const roll = Math.random()
    const type = enemy.cfg.heavy ? (roll < 0.5 ? 'ammo' : roll < 0.8 ? 'armor' : 'health') : roll < 0.44 ? 'ammo' : roll < 0.67 ? 'armor' : roll < 0.9 ? 'health' : 'grenade'
    this.spawnPickup(new THREE.Vector3(p.x + rand(-0.5, 0.5), 0, p.z + rand(-0.5, 0.5)), type)
  }

  spawnPickup(pos, type) {
    const colors = { ammo: 0xffc062, armor: 0x63c9ff, health: 0x68f09c, grenade: 0xffa14d }
    const geo = type === 'health' ? new THREE.BoxGeometry(0.28, 0.28, 0.2) : type === 'armor' ? new THREE.CylinderGeometry(0.18, 0.18, 0.24, 8) : new THREE.BoxGeometry(0.3, 0.2, 0.22)
    const mat = new THREE.MeshStandardMaterial({ color: 0x141a1d, emissive: colors[type], emissiveIntensity: 1.5, roughness: 0.45, metalness: 0.5 })
    const mesh = new THREE.Group()
    const item = new THREE.Mesh(geo, mat)
    mesh.add(item)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 18), new THREE.MeshBasicMaterial({ color: colors[type], transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.28; mesh.add(ring)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTextureSafe('glow'), color: colors[type], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(1.1, 1.1, 1); mesh.add(glow)
    mesh.position.copy(pos)
    mesh.position.y = this.world.groundHeightAt(pos.x, pos.z) + 0.45
    this.scene.add(mesh)
    this.pickups.push({ mesh, type, life: 30, phase: rand(0, 6), baseY: mesh.position.y })
  }

  clearPickups() {
    for (const p of this.pickups) { this.scene.remove(p.mesh); p.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } }) }
    this.pickups.length = 0
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]
      p.life -= dt
      p.phase += dt
      p.mesh.rotation.y += dt * 1.4
      p.mesh.position.y = p.baseY + Math.sin(p.phase * 2.2) * 0.09
      const d = Math.hypot(p.mesh.position.x - this.player.pos.x, p.mesh.position.z - this.player.pos.z)
      if (d < 1.5) {
        this.collectPickup(p)
        this.scene.remove(p.mesh)
        p.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
        this.pickups.splice(i, 1)
        continue
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        p.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
        this.pickups.splice(i, 1)
      }
    }
  }

  collectPickup(p) {
    this.audio.pickup()
    if (p.type === 'ammo') {
      this.weapon.addAmmo(0.45)
      this.hud.notify('<b>AMMO RESUPPLIED</b> // VK-7 / M9', 1300)
    } else if (p.type === 'armor') {
      this.player.armor = Math.min(100, this.player.armor + 30)
      this.hud.notify('<b>ARMOR PLATE</b> +30', 1300)
    } else if (p.type === 'health') {
      this.player.health = Math.min(100, this.player.health + 32)
      this.hud.notify('<b>MEDICAL</b> +32 VITALS', 1300)
    } else {
      this.grenades = Math.min(3, this.grenades + 1)
      this.hud.notify('<b>FRAG GRENADE</b> +1', 1300)
    }
  }

  update(dt) {
    this.time += dt
    this.comboTimer = Math.max(0, this.comboTimer - dt)
    if (this.comboTimer <= 0) this.combo = 1

    this.world.update(dt, this.time, this.player.pos)
    this.effects.update(dt, this.time)

    if (this.mode === 'menu') {
      this.menuAngle += dt * 0.045
      const r = 18.5
      this.camera.fov = 62
      this.camera.updateProjectionMatrix()
      this.camera.position.set(Math.sin(this.menuAngle) * r, 7.4 + Math.sin(this.time * 0.22) * 0.35, Math.cos(this.menuAngle) * r)
      this.camera.lookAt(0, 1.5, 0)
      this.camera.rotation.order = 'YXZ'
      this.player.cameraPos.copy(this.camera.position)
      this.fade = damp(this.fade, 0, 3, dt)
      this.grade.uniforms.fade.value = this.fade
      this.damageGrade = damp(this.damageGrade, 0, 4, dt)
      this.grade.uniforms.damage.value = this.damageGrade
      return
    }

    if (this.mode === 'paused') {
      this.grade.uniforms.fade.value = damp(this.grade.uniforms.fade.value, 0, 5, dt)
      return
    }

    if (this.mode === 'playing') {
      this.updatePlayer(dt)
      this.updateWaves(dt)
      this.enemies.update(dt, this.time, {
        pos: this.player.pos, cameraPos: this.camera.position, yaw: this.player.yaw,
        crouching: this.player.crouching, speed: this.player.speed,
      })
      this.updateGrenades(dt)
      this.updatePickups(dt)
      if (this.comboTimer <= 0) this.combo = 1
      this.thunderTimer -= dt
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 26 + Math.random() * 26
        this.audio.thunder()
        this.flashGrade = 0.055
      }
    } else if (this.mode === 'dead' || this.mode === 'victory') {
      this.resultTimer += dt
      if (this.mode === 'dead') {
        this.player.deathRoll = damp(this.player.deathRoll, 0.85, 2.5, dt)
        this.player.eye = damp(this.player.eye, 0.35, 2.2, dt)
        this.camera.position.set(this.player.pos.x, this.player.pos.y + this.player.eye, this.player.pos.z)
        this.camera.rotation.set(this.player.pitch + 0.2, this.player.yaw, this.player.deathRoll)
      }
      if (this.resultTimer > 1.7) this.showResults(this.mode === 'victory')
    }

    this.fade = damp(this.fade, 0, 3, dt)
    this.damageGrade = damp(this.damageGrade, 0, 3.8, dt)
    this.flashGrade = damp(this.flashGrade, 0, 6, dt)
    this.grade.uniforms.fade.value = this.fade
    this.grade.uniforms.damage.value = this.damageGrade
    this.grade.uniforms.flash.value = this.flashGrade
    this.grade.uniforms.lowHealth.value = this.player.health < 35 ? 1 - this.player.health / 35 : 0
    this.grade.uniforms.time.value = this.time

    if (this.mode === 'playing' || this.mode === 'dead' || this.mode === 'victory') {
      this.hud.update(dt, this.hudState())
    }
  }

  animate(now) {
    requestAnimationFrame(this.animate.bind(this))
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000))
    this.last = now
    this.update(dt)
    this.vmPass.enabled = this.weapon.visible && this.mode !== 'menu'
    this.composer.render()
  }
}

function spriteTextureSafe(kind) {
  // local helper to avoid a circular import at module scope
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,.9)')
  g.addColorStop(0.35, 'rgba(255,255,255,.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
