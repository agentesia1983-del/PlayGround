const pad = (n, l = 2) => String(Math.max(0, Math.floor(n))).padStart(l, '0')

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      healthFill: document.getElementById('health-fill'),
      healthValue: document.getElementById('health-value'),
      armorFill: document.getElementById('armor-fill'),
      armorValue: document.getElementById('armor-value'),
      healthWrap: document.querySelector('.health-wrap'),
      healthBar: document.querySelector('.health-bar'),
      ammoMag: document.getElementById('ammo-mag'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName: document.getElementById('weapon-name'),
      fireMode: document.getElementById('fire-mode'),
      reloadFill: document.getElementById('reload-fill'),
      grenadeCount: document.getElementById('grenade-count'),
      tGrenades: document.getElementById('t-grenades'),
      waveLabel: document.getElementById('wave-label'),
      enemyCount: document.getElementById('enemy-count'),
      objective: document.getElementById('objective-text'),
      score: document.getElementById('score'),
      combo: document.getElementById('combo'),
      compass: document.getElementById('compass-strip'),
      crosshair: document.getElementById('crosshair'),
      hitmarker: document.getElementById('hitmarker'),
      killfeed: document.getElementById('killfeed'),
      minimap: document.getElementById('minimap'),
      bossBar: document.getElementById('boss-bar'),
      bossName: document.getElementById('boss-name'),
      bossFill: document.getElementById('boss-fill'),
      bossHp: document.getElementById('boss-hp'),
      damageFlash: document.getElementById('damage-flash'),
      lowHealth: document.getElementById('low-health'),
      damageDirs: document.getElementById('damage-dirs'),
      banner: document.getElementById('wave-banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerSub: document.getElementById('banner-sub'),
      notification: document.getElementById('notification'),
      status: document.getElementById('status-text'),
      slots: [...document.querySelectorAll('.weapon-slots .slot')],
      reticleHint: document.getElementById('reticle-hint'),
      pause: document.getElementById('pause'),
      pauseWave: document.getElementById('pause-wave'),
      pauseKills: document.getElementById('pause-kills'),
      pauseScore: document.getElementById('pause-score'),
      results: document.getElementById('results'),
      resultKicker: document.getElementById('result-kicker'),
      resultTitle: document.getElementById('result-title'),
      resultSub: document.getElementById('result-sub'),
      resultWave: document.getElementById('result-wave'),
      resultKills: document.getElementById('result-kills'),
      resultAcc: document.getElementById('result-acc'),
      resultScore: document.getElementById('result-score'),
      resultBest: document.getElementById('result-best'),
      resultTime: document.getElementById('result-time'),
      bestScore: document.getElementById('best-score'),
      menu: document.getElementById('menu'),
      touch: document.getElementById('touch'),
      boot: document.getElementById('boot'),
      interact: document.getElementById('interact-prompt'),
    }
    this.ctx = this.el.minimap.getContext('2d')
    this.cache = {}
    this.dirEls = []
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div')
      d.className = 'dmg-dir'
      this.el.damageDirs.appendChild(d)
      this.dirEls.push(d)
    }
    this.dirIndex = 0
    this.buildCompass()
    this.bannerTimer = null
    this.notifTimer = null
    this.flashTimer = null
    this.lowPulse = false
    this.killTimes = []
    this.best = Number(localStorage.getItem('zerohour.best') || 0)
    this.setBest(this.best)
  }

  setBest(v) {
    this.best = v
    this.el.bestScore.textContent = `BEST SCORE — ${pad(v, 6)}`
  }

  buildCompass() {
    const strip = this.el.compass
    strip.innerHTML = ''
    const pxPerDeg = 2.6
    const cards = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }
    for (let deg = -360; deg <= 720; deg += 5) {
      const x = (deg + 360) * pxPerDeg
      const tick = document.createElement('i')
      const isMajor = deg % 45 === 0
      tick.className = 'comp-tick' + (isMajor ? ' major' : '')
      tick.style.left = x + 'px'
      strip.appendChild(tick)
      if (isMajor) {
        const label = document.createElement('span')
        label.className = 'comp-label' + ([0, 90, 180, 270].includes(((deg % 360) + 360) % 360) ? ' card' : '')
        label.style.left = x + 'px'
        label.textContent = cards[((deg % 360) + 360) % 360]
        strip.appendChild(label)
      } else if (deg % 15 === 0) {
        const dot = document.createElement('span')
        dot.className = 'comp-tick major'
        dot.style.left = (x + 1) + 'px'
        dot.style.height = '3px'
        dot.style.opacity = '.7'
        strip.appendChild(dot)
      }
    }
    this.pxPerDeg = pxPerDeg
    this.compassWidth = strip.parentElement.clientWidth || 420
  }

  updateHeading(deg) {
    const w = this.el.compass.parentElement.clientWidth
    if (w !== this.compassWidth) { this.compassWidth = w }
    const center = w / 2
    const x = center - (deg + 360) * this.pxPerDeg
    this.el.compass.style.transform = `translateX(${x}px)`
  }

  setHudVisible(v) { this.el.hud.classList.toggle('hidden', !v) }
  setMenuVisible(v) { this.el.menu.classList.toggle('hidden', !v) }
  setTouchVisible(v) { this.el.touch.classList.toggle('hidden', !v) }

  bootDone() {
    this.el.boot.classList.add('done')
    setTimeout(() => this.el.boot.classList.add('hidden'), 650)
  }

  showError(msg) {
    document.getElementById('error-screen').classList.remove('hidden')
    document.getElementById('error-text').textContent = msg
    this.el.boot.classList.add('hidden')
  }

  update(dt, state) {
    const c = this.cache
    const s = state
    const hp = Math.ceil(s.health), ar = Math.ceil(s.armor)
    if (c.hp !== hp) {
      c.hp = hp
      this.el.healthValue.textContent = hp
      this.el.healthFill.style.width = Math.max(0, Math.min(100, hp)) + '%'
      this.el.healthBar.classList.toggle('low', hp <= 34)
    }
    if (c.ar !== ar) {
      c.ar = ar
      this.el.armorValue.textContent = ar
      this.el.armorFill.style.width = Math.max(0, Math.min(100, ar)) + '%'
    }
    const ws = s.weapon
    if (c.mag !== ws.mag || c.reserve !== ws.reserve) {
      c.mag = ws.mag; c.reserve = ws.reserve
      this.el.ammoMag.textContent = pad(ws.mag, 2)
      this.el.ammoReserve.textContent = pad(ws.reserve, 3)
      this.el.ammoMag.style.color = ws.mag <= Math.ceil(ws.maxMag * 0.25) ? '#ff9b84' : ''
    }
    if (c.wname !== ws.name) { c.wname = ws.name; this.el.weaponName.textContent = ws.name; this.el.fireMode.textContent = ws.mode }
    if (c.widx !== ws.index) {
      c.widx = ws.index
      this.el.slots.forEach((s2, i) => s2.classList.toggle('active', i === ws.index))
    }
    const rp = ws.reloading ? Math.round(ws.reloadProgress * 100) : 0
    if (c.rp !== rp) { c.rp = rp; this.el.reloadFill.style.width = rp + '%' }
    if (c.gren !== s.grenades) { c.gren = s.grenades; this.el.grenadeCount.textContent = pad(s.grenades, 2); if (this.el.tGrenades) this.el.tGrenades.textContent = s.grenades }

    if (c.wave !== s.wave || c.left !== s.enemiesLeft) {
      c.wave = s.wave; c.left = s.enemiesLeft
      this.el.waveLabel.textContent = `WAVE ${pad(s.wave)} / ${pad(s.totalWaves)}`
      this.el.enemyCount.textContent = s.enemiesLeft === 1 ? '1 HOSTILE' : `${s.enemiesLeft} HOSTILES`
    }
    if (c.objective !== s.objective) { c.objective = s.objective; this.el.objective.textContent = s.objective }
    if (c.score !== s.score) {
      c.score = s.score
      this.el.score.textContent = pad(s.score, 6)
    }
    if (c.combo !== s.combo) {
      c.combo = s.combo
      this.el.combo.textContent = s.combo > 1 ? `×${s.combo} MULTI-KILL` : ''
      this.el.combo.classList.toggle('show', s.combo > 1)
    }
    const spread = 5 + s.spread * 900
    if (Math.abs((c.spread || 0) - spread) > 0.5) { c.spread = spread; this.el.crosshair.style.setProperty('--spread', spread.toFixed(1) + 'px') }
    const ads = s.weapon.ads > 0.55
    if (c.ads !== ads) { c.ads = ads; this.el.crosshair.classList.toggle('ads', ads) }

    const status = hp <= 30 ? 'CRITICAL' : ws.reloading ? 'RELOADING' : s.enemiesLeft > 0 ? 'ENGAGED' : 'STANDBY'
    if (c.status !== status) {
      c.status = status
      this.el.status.innerHTML = `<i></i>${status}`
      this.el.status.classList.toggle('hurt', hp <= 30)
    }

    this.updateHeading(s.heading)
    this.drawMinimap(s)
    this.updateBoss(s.boss)
    this.updateLowHealth(hp)
  }

  updateLowHealth(hp) {
    const low = hp <= 35
    this.el.lowHealth.style.opacity = low ? String(0.5 + (35 - hp) / 70) : '0'
    if (low !== this.lowPulse) {
      this.lowPulse = low
      this.el.lowHealth.classList.toggle('pulse', low)
    }
  }

  drawMinimap(s) {
    const ctx = this.ctx
    const W = 200
    const { staticMap, mapScale } = s.world
    ctx.clearRect(0, 0, W, W)
    ctx.drawImage(staticMap, 0, 0, W, W)
    // radar sweep
    ctx.save()
    ctx.translate(100, 100)
    ctx.rotate((performance.now() / 1000) * 1.1)
    const grad = ctx.createLinearGradient(0, 0, 100, 0)
    grad.addColorStop(0, 'rgba(120,220,240,0)')
    grad.addColorStop(1, 'rgba(120,220,240,.11)')
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 98, -0.55, 0); ctx.closePath(); ctx.fill()
    ctx.restore()

    const toPx = (v) => (v + 40) / 80 * W
    // pickups
    for (const p of s.pickups) {
      ctx.fillStyle = p.type === 'health' ? 'rgba(130,240,170,.95)' : p.type === 'armor' ? 'rgba(120,200,255,.95)' : 'rgba(255,190,90,.95)'
      ctx.beginPath(); ctx.arc(toPx(p.x), toPx(p.z), 2, 0, 7); ctx.fill()
    }
    // enemies
    for (const e of s.enemies) {
      if (e.dead) continue
      const x = toPx(e.x), y = toPx(e.z)
      const dist = Math.hypot(x - 100, y - 100)
      if (dist > 96) continue
      ctx.fillStyle = e.boss ? 'rgba(255,70,50,1)' : e.alerted ? 'rgba(255,100,70,.95)' : 'rgba(255,150,100,.6)'
      ctx.beginPath(); ctx.arc(x, y, e.boss ? 4 : 2.5, 0, 7); ctx.fill()
      if (e.alerted) { ctx.strokeStyle = 'rgba(255,80,50,.28)'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.stroke() }
    }
    // player
    const px = toPx(s.player.x), py = toPx(s.player.z)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(s.yaw)
    ctx.fillStyle = 'rgba(130,230,255,1)'
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.8); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = 'rgba(130,230,255,.22)'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke()
    ctx.restore()
    // border cross
    ctx.strokeStyle = 'rgba(120,200,220,.16)'
    ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, 200); ctx.moveTo(0, 100); ctx.lineTo(200, 100); ctx.stroke()
  }

  updateBoss(boss) {
    if (!boss) {
      if (this.cache.boss !== false) { this.el.bossBar.classList.add('hidden'); this.cache.boss = false }
      return
    }
    this.el.bossBar.classList.remove('hidden')
    this.cache.boss = true
    this.el.bossName.textContent = boss.name
    this.el.bossFill.style.width = Math.max(0, boss.hp / boss.max * 100) + '%'
    this.el.bossHp.textContent = Math.ceil(boss.hp / boss.max * 100) + '%'
  }

  hit(kind = 'body') {
    const hm = this.el.hitmarker
    hm.classList.remove('show', 'kill', 'head')
    hm.classList.add('show')
    if (kind === 'kill') hm.classList.add('kill')
    if (kind === 'head') hm.classList.add('head')
    // force reflow for repeated hits
    void hm.offsetWidth
  }

  addKill(weapon, head = false, boss = false) {
    const item = document.createElement('div')
    item.className = 'kill-item' + (head ? ' head' : '')
    item.innerHTML = `<b>RAVEN</b> ${boss ? '<em>// WARDEN</em> ' : ''}${head ? '<em>HEADSHOT</em> ' : ''}${weapon}`
    this.el.killfeed.prepend(item)
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove()
    setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity .4s'; setTimeout(() => item.remove(), 420) }, 4200)
  }

  damage(amount, angle) {
    this.el.damageFlash.style.opacity = String(Math.min(0.85, 0.25 + amount / 70))
    clearTimeout(this.flashTimer)
    this.flashTimer = setTimeout(() => { this.el.damageFlash.style.opacity = '0' }, 130)
    if (angle !== undefined) {
      const d = this.dirEls[this.dirIndex++ % this.dirEls.length]
      d.classList.remove('show')
      void d.offsetWidth
      d.style.setProperty('--rot', angle + 'rad')
      d.classList.add('show')
    }
  }

  showBanner(title, sub, kicker = 'INCOMING') {
    this.el.banner.querySelector('.banner-kicker').textContent = kicker
    this.el.bannerTitle.textContent = title
    this.el.bannerSub.textContent = sub
    this.el.banner.classList.remove('hidden', 'show')
    void this.el.banner.offsetWidth
    this.el.banner.classList.add('show')
    clearTimeout(this.bannerTimer)
    this.bannerTimer = setTimeout(() => this.el.banner.classList.add('hidden'), 2700)
  }

  notify(text, duration = 2200) {
    this.el.notification.innerHTML = text
    this.el.notification.classList.add('show')
    clearTimeout(this.notifTimer)
    this.notifTimer = setTimeout(() => this.el.notification.classList.remove('show'), duration)
  }

  prompt(text) {
    if (!text) { this.el.interact.classList.add('hidden'); return }
    this.el.interact.classList.remove('hidden')
    this.el.interact.innerHTML = text
  }

  showPause(show, state) {
    this.el.pause.classList.toggle('hidden', !show)
    if (show && state) {
      this.el.pauseWave.textContent = pad(state.wave)
      this.el.pauseKills.textContent = pad(state.kills)
      this.el.pauseScore.textContent = pad(state.score, 6)
    }
  }

  showResults(win, state) {
    this.el.results.classList.remove('hidden')
    this.el.resultKicker.textContent = win ? 'MISSION COMPLETE' : 'MISSION FAILED'
    this.el.resultTitle.textContent = win ? 'SECTOR SECURED' : 'OPERATOR DOWN'
    this.el.resultSub.textContent = win ? 'Kilo-7 is quiet. For now.' : 'The line broke. Hold it longer next time.'
    this.el.resultWave.textContent = pad(state.wave, 2)
    this.el.resultKills.textContent = pad(state.kills, 2)
    this.el.resultAcc.textContent = state.accuracy + '%'
    this.el.resultScore.textContent = pad(state.score, 6)
    this.el.resultBest.textContent = pad(state.best, 6)
    this.el.resultTime.textContent = state.time
  }

  hideResults() { this.el.results.classList.add('hidden') }

  setReticleHint(v) { this.el.reticleHint.classList.toggle('hidden', !v) }

  setSoundMuted(m) {
    document.querySelectorAll('#btn-sound, #btn-menu-sound').forEach(b => b.classList.toggle('muted', m))
    localStorage.setItem('zerohour.muted', m ? '1' : '0')
  }
}
