import * as THREE from 'three'

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

function tex(c, { srgb = false, repeat = 1, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

function noiseFill(ctx, size, base, variance, rng) {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * variance
    d[i] = base[0] + n
    d[i + 1] = base[1] + n
    d[i + 2] = base[2] + n
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function blotches(ctx, size, rng, count, colors, minR, maxR, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rng() * size, y = rng() * size
    const r = minR + rng() * (maxR - minR)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const c = colors[Math.floor(rng() * colors.length)]
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`)
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
}

function cracks(ctx, size, rng, count, color, width = 1) {
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    let x = rng() * size, y = rng() * size
    let a = rng() * Math.PI * 2
    ctx.strokeStyle = color
    ctx.lineWidth = width * (0.5 + rng())
    ctx.beginPath(); ctx.moveTo(x, y)
    const steps = 5 + Math.floor(rng() * 14)
    for (let s = 0; s < steps; s++) {
      a += (rng() - 0.5) * 1.3
      x += Math.cos(a) * (3 + rng() * 10)
      y += Math.sin(a) * (3 + rng() * 10)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function normalFromHeight(heightCanvas, strength = 2.2) {
  const size = heightCanvas.width
  const hctx = heightCanvas.getContext('2d')
  const src = hctx.getImageData(0, 0, size, size).data
  const out = canvas(size)
  const octx = out.getContext('2d')
  const img = octx.createImageData(size, size)
  const d = img.data
  const at = (x, y) => {
    x = (x + size) % size; y = (y + size) % size
    return src[(y * size + x) * 4] / 255
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      let nx = -dx, ny = -dy, nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l; ny /= l; nz /= l
      const i = (y * size + x) * 4
      d[i] = (nx * 0.5 + 0.5) * 255
      d[i + 1] = (ny * 0.5 + 0.5) * 255
      d[i + 2] = (nz * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

export function concreteTextures(seed = 7, size = 512) {
  const rng = mulberry32(seed)
  const albedo = canvas(size), rough = canvas(size), height = canvas(size)
  const ac = albedo.getContext('2d'), rc = rough.getContext('2d'), hc = height.getContext('2d')
  noiseFill(ac, size, [78, 82, 84], 44, rng)
  blotches(ac, size, rng, 34, [[42, 45, 46], [100, 103, 100], [60, 64, 64], [110, 108, 100]], 20, 110, 0.16)
  cracks(ac, size, rng, 15, 'rgba(25,28,28,.55)', 1.2)
  // rust / water streaks
  for (let i = 0; i < 24; i++) {
    const x = rng() * size, y = rng() * size * 0.5
    const w = 2 + rng() * 9, h = 30 + rng() * 160
    const g = ac.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, `rgba(58,48,36,${0.14 + rng() * 0.18})`)
    g.addColorStop(1, 'rgba(58,48,36,0)')
    ac.fillStyle = g; ac.fillRect(x, y, w, h)
  }
  noiseFill(rc, size, [185, 185, 185], 60, rng)
  blotches(rc, size, rng, 22, [[80, 80, 80], [225, 225, 225], [130, 130, 130]], 20, 90, 0.25)
  noiseFill(hc, size, [128, 128, 128], 70, rng)
  cracks(hc, size, rng, 18, 'rgba(32,32,32,.9)', 2)
  blotches(hc, size, rng, 20, [[90, 90, 90], [165, 165, 165]], 20, 100, 0.2)
  return {
    map: tex(albedo, { srgb: true }),
    roughnessMap: tex(rough),
    normalMap: tex(normalFromHeight(height, 2.4)),
  }
}

export function wetGroundTextures(seed = 12, size = 512) {
  const rng = mulberry32(seed)
  const albedo = canvas(size), rough = canvas(size), height = canvas(size)
  const ac = albedo.getContext('2d'), rc = rough.getContext('2d'), hc = height.getContext('2d')
  noiseFill(ac, size, [48, 52, 54], 34, rng)
  blotches(ac, size, rng, 40, [[30, 34, 35], [60, 64, 64], [40, 43, 45]], 20, 120, 0.2)
  cracks(ac, size, rng, 22, 'rgba(18,21,22,.6)', 1.4)
  // puddles: darker and very smooth
  noiseFill(rc, size, [205, 205, 205], 40, rng)
  noiseFill(hc, size, [120, 120, 120], 50, rng)
  for (let i = 0; i < 26; i++) {
    const x = rng() * size, y = rng() * size
    const rx = 18 + rng() * 70, ry = 10 + rng() * 34
    const g = ac.createRadialGradient(x, y, 1, x, y, rx)
    g.addColorStop(0, 'rgba(12,18,21,.85)')
    g.addColorStop(0.7, 'rgba(16,22,25,.65)')
    g.addColorStop(1, 'rgba(20,25,27,0)')
    ac.save(); ac.translate(x, y); ac.rotate(rng() * Math.PI); ac.scale(1, ry / rx)
    ac.fillStyle = g; ac.beginPath(); ac.arc(0, 0, rx, 0, Math.PI * 2); ac.fill(); ac.restore()
    rc.save(); rc.translate(x, y); rc.rotate(rng() * Math.PI); rc.scale(1, ry / rx)
    const rg = rc.createRadialGradient(0, 0, 1, 0, 0, rx)
    rg.addColorStop(0, 'rgba(8,8,8,.95)'); rg.addColorStop(0.8, 'rgba(22,22,22,.8)'); rg.addColorStop(1, 'rgba(60,60,60,0)')
    rc.fillStyle = rg; rc.beginPath(); rc.arc(0, 0, rx, 0, Math.PI * 2); rc.fill(); rc.restore()
    hc.save(); hc.translate(x, y); hc.rotate(rng() * Math.PI); hc.scale(1, ry / rx)
    const hg = hc.createRadialGradient(0, 0, 1, 0, 0, rx)
    hg.addColorStop(0, 'rgba(70,70,70,.6)'); hg.addColorStop(1, 'rgba(120,120,120,0)')
    hc.fillStyle = hg; hc.beginPath(); hc.arc(0, 0, rx, 0, Math.PI * 2); hc.fill(); hc.restore()
  }
  // grime streaks
  for (let i = 0; i < 30; i++) {
    const x = rng() * size, y = rng() * size
    ac.strokeStyle = `rgba(20,24,24,${0.05 + rng() * 0.1})`
    ac.lineWidth = 1 + rng() * 5
    ac.beginPath(); ac.moveTo(x, y); ac.lineTo(x + (rng() - 0.5) * 90, y + (rng() - 0.5) * 90); ac.stroke()
  }
  return {
    map: tex(albedo, { srgb: true, repeat: 5 }),
    roughnessMap: tex(rough, { repeat: 5 }),
    normalMap: tex(normalFromHeight(height, 1.7), { repeat: 5 }),
  }
}

export function metalTextures(base = [68, 76, 78], seed = 21, corrugated = true, size = 512) {
  const rng = mulberry32(seed)
  const albedo = canvas(size), rough = canvas(size), height = canvas(size)
  const ac = albedo.getContext('2d'), rc = rough.getContext('2d'), hc = height.getContext('2d')
  noiseFill(ac, size, base, 22, rng)
  noiseFill(rc, size, [120, 120, 120], 50, rng)
  noiseFill(hc, size, [128, 128, 128], 14, rng)
  for (let i = 0; i < 40; i++) {
    const x = rng() * size, y = rng() * size, h = 20 + rng() * 180
    const g = ac.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, `rgba(90,48,24,${0.08 + rng() * 0.22})`)
    g.addColorStop(1, 'rgba(90,48,24,0)')
    ac.fillStyle = g; ac.fillRect(x, y, 2 + rng() * 10, h)
    rc.fillStyle = 'rgba(60,60,60,.2)'; rc.fillRect(x, y, 2 + rng() * 8, h)
  }
  for (let i = 0; i < 80; i++) {
    const x = rng() * size, y = rng() * size
    ac.strokeStyle = `rgba(180,188,188,${0.05 + rng() * 0.18})`
    ac.lineWidth = 0.5 + rng()
    ac.beginPath(); ac.moveTo(x, y); ac.lineTo(x + (rng() - 0.5) * 40, y + (rng() - 0.5) * 8); ac.stroke()
  }
  if (corrugated) {
    const period = 26
    for (let x = 0; x < size; x++) {
      const v = Math.sin((x / period) * Math.PI * 2) * 0.5 + 0.5
      const shade = v * 30 - 15
      ac.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade) / 255})`
      ac.fillRect(x, 0, 1, size)
      hc.fillStyle = `rgb(${100 + v * 90},${100 + v * 90},${100 + v * 90})`
      hc.fillRect(x, 0, 1, size)
    }
    for (let y = 0; y < size; y += 64) {
      ac.fillStyle = 'rgba(20,26,27,.25)'; ac.fillRect(0, y, size, 2)
    }
  }
  // rivets
  for (let i = 0; i < 50; i++) {
    const x = rng() * size, y = rng() * size
    ac.fillStyle = 'rgba(30,34,35,.55)'; ac.beginPath(); ac.arc(x, y, 2.2, 0, 7); ac.fill()
    ac.fillStyle = 'rgba(150,158,158,.25)'; ac.beginPath(); ac.arc(x - .6, y - .6, 1.1, 0, 7); ac.fill()
  }
  return {
    map: tex(albedo, { srgb: true, repeat: 1 }),
    roughnessMap: tex(rough),
    normalMap: tex(normalFromHeight(height, corrugated ? 3.2 : 1.1)),
  }
}

export function crateTextures(seed = 31, size = 256) {
  const rng = mulberry32(seed)
  const albedo = canvas(size), height = canvas(size)
  const ac = albedo.getContext('2d'), hc = height.getContext('2d')
  noiseFill(ac, size, [96, 78, 52], 26, rng)
  noiseFill(hc, size, [128, 128, 128], 40, rng)
  for (let i = 0; i < 12; i++) {
    const y = rng() * size
    ac.fillStyle = `rgba(${40 + rng() * 30},${30 + rng() * 20},${18 + rng() * 12},${0.2 + rng() * 0.25})`
    ac.fillRect(0, y, size, 1 + rng() * 3)
    hc.fillStyle = 'rgba(60,60,60,.4)'; hc.fillRect(0, y, size, 1 + rng() * 2)
  }
  ac.strokeStyle = 'rgba(30,24,16,.6)'; ac.lineWidth = 6; ac.strokeRect(8, 8, size - 16, size - 16)
  ac.strokeStyle = 'rgba(30,24,16,.45)'; ac.lineWidth = 3
  ac.beginPath(); ac.moveTo(10, 10); ac.lineTo(size - 10, size - 10); ac.moveTo(size - 10, 10); ac.lineTo(10, size - 10); ac.stroke()
  hc.strokeStyle = 'rgba(70,70,70,.8)'; hc.lineWidth = 7; hc.strokeRect(8, 8, size - 16, size - 16)
  return { map: tex(albedo, { srgb: true }), normalMap: tex(normalFromHeight(height, 2.4)) }
}

export function chainlinkTexture(size = 256) {
  const c = canvas(size), ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(178,190,196,.75)'
  ctx.lineWidth = 1.4
  const step = size / 12
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - size, size); ctx.stroke()
  }
  const t = tex(c, { repeat: 1 })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function buildingWindowsTexture(seed = 4, size = 256) {
  const rng = mulberry32(seed)
  const c = canvas(size), ctx = c.getContext('2d')
  ctx.fillStyle = '#05080b'; ctx.fillRect(0, 0, size, size)
  const cols = 12, rows = 20
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > 0.62
      if (!lit) continue
      const warm = rng()
      ctx.fillStyle = warm > 0.75 ? 'rgba(255,180,100,.9)' : warm > 0.3 ? 'rgba(190,210,220,.65)' : 'rgba(120,170,190,.5)'
      ctx.globalAlpha = 0.25 + rng() * 0.7
      ctx.fillRect(4 + x * (size / cols), 4 + y * (size / rows), size / cols - 6, size / rows - 8)
    }
  }
  ctx.globalAlpha = 1
  return tex(c, { srgb: true })
}

export function signTexture(lines, { fg = '#ffb457', bg = 'rgba(8,12,14,.92)', border = true, sub = '', width = 512, height = 256, font = 700 } = {}) {
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height)
  if (border) {
    ctx.strokeStyle = fg; ctx.lineWidth = 7; ctx.strokeRect(13, 13, width - 26, height - 26)
    ctx.lineWidth = 2; ctx.strokeRect(24, 24, width - 48, height - 48)
  }
  ctx.fillStyle = fg
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lineHeight = height / (lines.length + (sub ? 1.8 : 0.6))
  lines.forEach((line, i) => {
    const size = Math.min(lineHeight * 1.25, width / (line.length * 0.62))
    ctx.font = `${font} ${size}px Rajdhani, sans-serif`
    ctx.fillText(line, width / 2, lineHeight * (i + 0.65))
  })
  if (sub) {
    ctx.font = `600 ${lineHeight * 0.32}px Rajdhani, sans-serif`
    ctx.fillStyle = 'rgba(220,235,242,.7)'
    ctx.fillText(sub, width / 2, height - lineHeight * 0.56)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function decalTexture(kind = 'bullet', size = 128) {
  const c = canvas(size), ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  if (kind === 'bullet') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size * 0.34)
    g.addColorStop(0, 'rgba(5,6,7,.95)'); g.addColorStop(0.45, 'rgba(12,14,15,.85)'); g.addColorStop(1, 'rgba(20,22,22,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.34, 0, 7); ctx.fill()
    ctx.strokeStyle = 'rgba(140,140,130,.25)'; ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4
      ctx.beginPath(); ctx.moveTo(size / 2, size / 2)
      ctx.lineTo(size / 2 + Math.cos(a) * size * 0.4, size / 2 + Math.sin(a) * size * 0.4); ctx.stroke()
    }
  } else if (kind === 'scorch') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.48)
    g.addColorStop(0, 'rgba(6,6,6,.9)'); g.addColorStop(0.5, 'rgba(14,13,12,.55)'); g.addColorStop(1, 'rgba(20,18,16,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.48, 0, 7); ctx.fill()
  } else if (kind === 'blood') {
    ctx.fillStyle = 'rgba(70,7,7,.85)'
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * size * 0.32
      ctx.beginPath(); ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 2 + Math.random() * 9, 0, 7); ctx.fill()
    }
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.25)
    g.addColorStop(0, 'rgba(90,10,10,.9)'); g.addColorStop(1, 'rgba(60,5,5,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.25, 0, 7); ctx.fill()
  } else if (kind === 'helipad') {
    ctx.strokeStyle = 'rgba(235,244,248,.78)'; ctx.lineWidth = 9
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.43, 0, 7); ctx.stroke()
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.38, 0, 7); ctx.stroke()
    ctx.fillStyle = 'rgba(235,244,248,.8)'
    ctx.font = `700 ${size * 0.46}px Rajdhani, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', size / 2, size / 2 + size * 0.02)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function radialSprite(size, stops, power = 2) {
  const c = canvas(size), ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([p, col]) => g.addColorStop(p, col))
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function spriteTexture(kind = 'glow') {
  if (kind === 'glow') return radialSprite(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']])
  if (kind === 'flash') {
    const size = 256
    const c = canvas(size), ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.15, 'rgba(255,210,120,.9)'); g.addColorStop(0.4, 'rgba(255,140,40,.3)'); g.addColorStop(1, 'rgba(255,90,20,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5
      const lg = ctx.createLinearGradient(size / 2, size / 2, size / 2 + Math.cos(a) * size * 0.5, size / 2 + Math.sin(a) * size * 0.5)
      lg.addColorStop(0, 'rgba(255,220,150,.75)'); lg.addColorStop(1, 'rgba(255,140,40,0)')
      ctx.strokeStyle = lg; ctx.lineWidth = 3 + Math.random() * 5
      ctx.beginPath(); ctx.moveTo(size / 2, size / 2); ctx.lineTo(size / 2 + Math.cos(a) * size * 0.48, size / 2 + Math.sin(a) * size * 0.48); ctx.stroke()
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }
  if (kind === 'smoke') return radialSprite(128, [[0, 'rgba(255,255,255,.55)'], [0.35, 'rgba(255,255,255,.28)'], [0.75, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']])
  if (kind === 'spark') return radialSprite(64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,230,180,.8)'], [1, 'rgba(255,120,30,0)']])
  if (kind === 'flare') {
    const size = 256
    const c = canvas(size), ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.09, 'rgba(255,220,160,.9)'); g.addColorStop(0.22, 'rgba(255,150,70,.32)'); g.addColorStop(0.55, 'rgba(255,120,50,.06)'); g.addColorStop(1, 'rgba(255,120,50,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(255,210,150,.22)'
    ctx.fillRect(0, size / 2 - 1, size * 0.5, 2)
    ctx.beginPath(); ctx.ellipse(size / 2, size / 2, size * 0.42, 2.2, 0, 0, 7); ctx.fill()
    ctx.fillStyle = 'rgba(255,190,120,.12)'
    ctx.beginPath(); ctx.ellipse(size / 2, size / 2, size * 0.12, size * 0.4, 0, 0, 7); ctx.fill()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }
  return radialSprite(128, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']])
}

export function envTexture() {
  const w = 512, h = 256
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#050a12'); g.addColorStop(0.42, '#0b1722'); g.addColorStop(0.58, '#243440'); g.addColorStop(0.66, '#503b2d'); g.addColorStop(0.78, '#131d24'); g.addColorStop(1, '#05080b')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  // city glow bands
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w, r = 10 + Math.random() * 50
    const rg = ctx.createRadialGradient(x, h * 0.63, 0, x, h * 0.63, r)
    rg.addColorStop(0, 'rgba(255,160,80,.18)'); rg.addColorStop(1, 'rgba(255,120,50,0)')
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, h * 0.63, r, 0, 7); ctx.fill()
  }
  const mont = ctx.createLinearGradient(0, 0, 0, h)
  mont.addColorStop(0, 'rgba(20,34,44,0)'); mont.addColorStop(1, 'rgba(18,28,35,.5)')
  ctx.fillStyle = mont; ctx.fillRect(0, h * 0.45, w, h * 0.2)
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function uiNoiseTexture(size = 128) {
  const c = canvas(size), ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
