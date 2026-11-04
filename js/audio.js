export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.dry = null
    this.wet = null
    this.convolver = null
    this.noise = null
    this.volume = 0.6
    this.muted = false
    this.ready = false
    this.intensity = 0
    this.ambient = null
    this.lastFoot = 0
    this.thunderTimer = 8 + Math.random() * 14
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = this.ctx = new AC()
    const master = this.master = ctx.createGain()
    master.gain.value = this.muted ? 0 : this.volume
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.2
    master.connect(comp)
    comp.connect(ctx.destination)

    this.dry = ctx.createGain()
    this.dry.gain.value = 0.92
    this.dry.connect(master)
    this.convolver = ctx.createConvolver()
    this.convolver.buffer = this.makeImpulse(2.4, 3.2)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.16
    this.convolver.connect(this.wet)
    this.wet.connect(master)

    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noise = buf

    this.startAmbient()
    this.ready = true
  }

  makeImpulse(duration, decay) {
    const ctx = this.ctx
    const rate = ctx.sampleRate
    const len = Math.floor(rate * duration)
    const buf = ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const t = i / len
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1)
      }
    }
    return buf
  }

  startAmbient() {
    const ctx = this.ctx
    const amb = ctx.createGain()
    amb.gain.value = 0.22
    amb.connect(this.dry)
    this.ambient = amb

    const wind = ctx.createBufferSource()
    wind.buffer = this.noise
    wind.loop = true
    const wf = ctx.createBiquadFilter()
    wf.type = 'lowpass'; wf.frequency.value = 520; wf.Q.value = 0.6
    const wg = ctx.createGain(); wg.gain.value = 0.055
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.028
    lfo.connect(lfoGain); lfoGain.connect(wg.gain)
    wind.connect(wf); wf.connect(wg); wg.connect(amb)
    wind.start(); lfo.start()

    const rain = ctx.createBufferSource()
    rain.buffer = this.noise
    rain.loop = true
    const rf = ctx.createBiquadFilter()
    rf.type = 'highpass'; rf.frequency.value = 1400; rf.Q.value = 0.4
    const rg = ctx.createGain(); rg.gain.value = 0.018
    rain.connect(rf); rf.connect(rg); rg.connect(amb)
    rain.start()

    const droneGain = ctx.createGain(); droneGain.gain.value = 0.042
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 190
    droneGain.connect(droneFilter); droneFilter.connect(amb)
    for (const [f, det, g] of [[41.2, 0, 1], [55, 0.4, 0.7], [82.4, -0.3, 0.35]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det * 100
      const og = ctx.createGain(); og.gain.value = g
      o.connect(og); og.connect(droneGain); o.start()
    }
    const pulse = ctx.createOscillator(); pulse.frequency.value = 0.11
    const pulseGain = ctx.createGain(); pulseGain.gain.value = 0.022
    pulse.connect(pulseGain); pulseGain.connect(droneGain.gain); pulse.start()
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05)
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.03)
  }

  setIntensity(v) {
    this.intensity = v
    if (!this.ready) return
    const t = this.ctx.currentTime
    this.ambient?.gain.setTargetAtTime(0.2 + v * 0.1, t, 1.5)
  }

  now() { return this.ctx ? this.ctx.currentTime : 0 }

  route(node, pan = 0, wet = 0.2) {
    const ctx = this.ctx
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    node.connect(p)
    p.connect(this.dry)
    if (wet > 0) {
      const s = ctx.createGain(); s.gain.value = wet
      p.connect(s); s.connect(this.convolver)
    }
  }

  noiseSource(duration, { rate = 1, type = 'lowpass', freq = 1200, q = 0.7, gain = 0.2, attack = 0.003, pan = 0, wet = 0.2 } = {}) {
    if (!this.ready || this.muted) return
    const ctx = this.ctx, t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = rate
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(f); f.connect(g); this.route(g, pan, wet)
    src.start(t, Math.random() * 1.2, duration + 0.05)
  }

  tone(freq, duration, { type = 'sine', gain = 0.1, endFreq = null, attack = 0.004, pan = 0, wet = 0.1, delay = 0 } = {}) {
    if (!this.ready || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t)
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    o.connect(g); this.route(g, pan, wet)
    o.start(t); o.stop(t + duration + 0.02)
  }

  shot(kind = 'rifle') {
    if (!this.ready) return
    const rifle = kind !== 'pistol'
    this.noiseSource(rifle ? 0.22 : 0.16, { freq: rifle ? 3800 : 3000, q: 0.9, gain: 0.28, wet: 0.3, pan: (Math.random() - 0.5) * 0.1 })
    this.noiseSource(0.06, { type: 'highpass', freq: 2200, gain: 0.16, wet: 0.12 })
    this.tone(rifle ? 118 : 150, 0.13, { endFreq: 48, gain: 0.34, wet: 0.2, type: 'sine' })
    this.tone(rifle ? 280 : 340, 0.045, { endFreq: 90, gain: 0.08, type: 'triangle', wet: 0.1 })
  }

  enemyShot(distance = 10, pan = 0, heavy = false) {
    if (!this.ready) return
    const att = 1 / (1 + distance * 0.055)
    this.noiseSource(heavy ? 0.24 : 0.18, { freq: 2600, gain: 0.24 * att, pan, wet: 0.35 })
    this.tone(heavy ? 80 : 105, 0.16, { endFreq: 42, gain: 0.28 * att, pan, wet: 0.2 })
  }

  dryFire() { this.tone(1300, 0.03, { type: 'square', gain: 0.05, wet: 0.05 }) }

  reloadStep(stage = 0) {
    if (!this.ready) return
    const t = this.now()
    if (stage === 0) { this.tone(760, 0.05, { type: 'square', gain: 0.045, wet: 0.04 }); this.noiseSource(0.08, { type: 'bandpass', freq: 1200, gain: 0.05, wet: 0.05 }) }
    else if (stage === 1) { this.noiseSource(0.13, { type: 'bandpass', freq: 700, gain: 0.06, wet: 0.08 }) }
    else if (stage === 2) { this.tone(420, 0.05, { type: 'square', gain: 0.06, wet: 0.04 }); this.noiseSource(0.06, { type: 'highpass', freq: 1800, gain: 0.06, wet: 0.04 }) }
    else { this.tone(980, 0.04, { type: 'square', gain: 0.04, wet: 0.03 }) }
  }

  footstep(run = false) {
    if (!this.ready || this.muted) return
    const now = this.now()
    if (now - this.lastFoot < 0.16) return
    this.lastFoot = now
    this.noiseSource(0.11, { type: 'bandpass', freq: run ? 380 : 300, q: 1.2, gain: run ? 0.055 : 0.035, wet: 0.12, pan: Math.random() * 0.1 })
    if (Math.random() > 0.6) this.noiseSource(0.05, { type: 'highpass', freq: 2600, gain: 0.012, wet: 0.06 })
  }

  hit(head = false, kill = false) {
    if (!this.ready) return
    this.tone(head ? 2100 : 1500, 0.05, { type: 'triangle', gain: head ? 0.09 : 0.055, endFreq: head ? 1500 : 1200, wet: 0.08 })
    if (kill) this.tone(660, 0.18, { type: 'triangle', gain: 0.08, endFreq: 990, delay: 0.03, wet: 0.12 })
  }

  explosion(distance = 0, pan = 0) {
    if (!this.ready) return
    const att = 1 / (1 + distance * 0.03)
    this.noiseSource(1.1, { freq: 330, q: 0.5, gain: 0.42 * att, pan, wet: 0.6 })
    this.noiseSource(0.25, { type: 'highpass', freq: 900, gain: 0.2 * att, pan, wet: 0.35 })
    this.tone(58, 0.9, { endFreq: 26, gain: 0.5 * att, pan, wet: 0.4 })
  }

  grenadeThrow() {
    this.noiseSource(0.18, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.05, wet: 0.08 })
  }

  melee() {
    this.noiseSource(0.2, { type: 'bandpass', freq: 600, q: 1.6, gain: 0.1, wet: 0.1 })
    this.tone(180, 0.12, { endFreq: 80, gain: 0.06, wet: 0.1 })
  }

  pickup() {
    this.tone(880, 0.12, { type: 'triangle', gain: 0.08, wet: 0.12 })
    this.tone(1320, 0.16, { type: 'triangle', gain: 0.06, delay: 0.08, wet: 0.12 })
  }

  waveStart(wave = 1) {
    if (!this.ready) return
    this.tone(55, 1.2, { type: 'sawtooth', gain: 0.08, endFreq: 82, wet: 0.3 })
    this.tone(110, 1.0, { type: 'triangle', gain: 0.06, endFreq: 110, delay: 0.1, wet: 0.3 })
    for (let i = 0; i < 3; i++) this.tone(440 + i * 110, 0.09, { type: 'square', gain: 0.03, delay: 0.18 * i, wet: 0.2 })
  }

  waveClear() {
    this.tone(392, 0.18, { type: 'triangle', gain: 0.07, wet: 0.2 })
    this.tone(523, 0.22, { type: 'triangle', gain: 0.07, delay: 0.14, wet: 0.2 })
    this.tone(659, 0.3, { type: 'triangle', gain: 0.06, delay: 0.28, wet: 0.2 })
  }

  victory() {
    const notes = [392, 523, 659, 784, 1046]
    notes.forEach((n, i) => this.tone(n, 0.5, { type: 'triangle', gain: 0.07, delay: i * 0.18, wet: 0.4 }))
    this.tone(98, 2.2, { type: 'sawtooth', gain: 0.05, endFreq: 130, wet: 0.3 })
  }

  defeat() {
    this.tone(196, 1.6, { type: 'sawtooth', gain: 0.07, endFreq: 55, wet: 0.4 })
    this.tone(147, 2.2, { type: 'triangle', gain: 0.05, endFreq: 42, wet: 0.4 })
  }

  damage() {
    this.noiseSource(0.18, { type: 'lowpass', freq: 420, gain: 0.15, wet: 0.2 })
    this.tone(70, 0.25, { endFreq: 40, gain: 0.1, wet: 0.1 })
  }

  heartbeat() {
    this.tone(58, 0.14, { endFreq: 38, gain: 0.12, wet: 0.05 })
    this.tone(52, 0.12, { endFreq: 36, gain: 0.08, delay: 0.18, wet: 0.05 })
  }

  thunder() {
    if (!this.ready) return
    this.noiseSource(2.6, { freq: 180, q: 0.4, gain: 0.12, attack: 0.08, wet: 0.7 })
    this.tone(38, 2.2, { endFreq: 20, gain: 0.12, wet: 0.5 })
  }

  ui() { this.tone(620, 0.04, { type: 'square', gain: 0.03, wet: 0.03 }) }
}
