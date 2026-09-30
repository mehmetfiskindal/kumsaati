import { ReactiveComponent, mount } from '@geastack/core'
import type { AudioContext as GeaAudioContext } from '@geastack/core'
import './styles.css'

const MIN_INTERVAL_SECONDS = 15
const MAX_INTERVAL_SECONDS = 360
const INTERVAL_STEP_SECONDS = 5

declare const __gea_audioContext: GeaAudioContext

export class App extends ReactiveComponent {
  selectedSeconds = 40
  remainingMs = 40_000
  completedCycles = 0
  isRunning = false
  isPaused = false
  soundEnabled = true
  hourglassFlipped = false
  hourglassRotation = 0

  private intervalId: number | null = null
  private deadlineAtMs = 0
  private lastAnnouncedSecond = 40
  private hasAudioContext = false
  private suppressClickUntilMs = 0
  private touchMoved = false
  private flipStartedAtMs = 0
  private flipFromDegrees = 0

  template() {
    return (
      <div class="app">
        <div class="timer-shell">
          <div class="focus-panel">
            <div class="brand-row">
              <div class="brand-lockup">
                <div class="brand-name">AKIŞ / ARALIK</div>
              </div>
              <div class="live-pill"><span class={`status-dot ${this.isRunning ? 'active' : ''}`} />{this.isRunning ? 'ZAMAN AKIYOR' : this.isPaused ? 'DÖNGÜ DURAKLATILDI' : 'YENİ DÖNGÜYE HAZIR'}</div>
            </div>

            <div class="focus-heading">
              <span class="eyebrow">TEKRAR EDEN ZAMANLAYICI</span>
              <h1>Ritmini yakala.</h1>
              <p>Bir aralık seç. Kum aksın, döngün kendini bulsun.</p>
            </div>

            <div class="timer-stage">
              <div class="hourglass-scene">
                <div class={`hourglass ${this.hourglassFlipped ? 'flipped' : ''} ${this.isRunning ? 'flowing' : ''}`} style={{ transform: `rotate(${this.hourglassRotation}deg)` }}>
                  <div class="glass-cap cap-top" />
                  <div class="chamber chamber-top">
                    <div class="glass-inner"><div class="sand sand-top" style={{ transform: `scaleY(${Math.max(0, Math.min(1, this.hourglassFlipped ? 1 - this.remainingMs / (this.selectedSeconds * 1000) : this.remainingMs / (this.selectedSeconds * 1000)))})` }} /></div>
                  </div>
                  <div class="glass-neck"><div class="sand-stream" style={{ opacity: this.isRunning ? 0.35 + 0.65 * ((this.remainingMs % 240) / 240) : 0 }} /></div>
                  <div class="chamber chamber-bottom">
                    <div class="glass-inner"><div class="sand sand-bottom" style={{ transform: `scaleY(${Math.max(0, Math.min(1, this.hourglassFlipped ? this.remainingMs / (this.selectedSeconds * 1000) : 1 - this.remainingMs / (this.selectedSeconds * 1000)))})` }} /></div>
                  </div>
                  <div class="glass-cap cap-bottom" />
                </div>
              </div>

              <div class="time-readout">
                <div class="cycle-kicker"><span>ŞİMDİKİ DÖNGÜ</span><span>#{String(this.completedCycles + 1).padStart(2, '0')}</span></div>
                <div class="time-value">{this.formatTime(Math.ceil(this.remainingMs / 1000))}</div>
                <div class="time-units">KALAN SÜRE · DK : SN</div>
                <div class="cycle-progress"><div class="cycle-progress-fill" style={{ width: `${Math.max(0, Math.min(100, (1 - this.remainingMs / (this.selectedSeconds * 1000)) * 100))}%` }} /></div>
                <div class="next-cycle-copy">{this.formatDuration(this.selectedSeconds)} aralıklarla tekrar eder</div>
              </div>
            </div>

            <div class="focus-footer">
              <div class="completed-count"><span class="count-number">{String(this.completedCycles).padStart(2, '0')}</span><span class="count-caption"><span>TAMAMLANAN</span><span>DÖNGÜ</span></span></div>
              <div class="footer-note"><span class="footer-spark">✳</span><span><span>Kum miktarı değiştikçe</span><span>ritmin de değişir.</span></span></div>
            </div>
          </div>

          <div class="control-panel">
            <div class="control-topline">ARALIK AYARI</div>
            <div class="control-heading">
              <h2>Kum miktarını belirle</h2>
              <p><span>Döngü süreni ayarla.</span><span>Zamanlayıcı aynı aralıkla tekrar eder.</span></p>
            </div>

            <div class="duration-section">
              <div class="section-label"><span>TEKRAR ARALIĞI</span><span>5 SN ADIMLARLA</span></div>
              <div class="duration-stepper">
                <button class="stepper-button" onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.adjustInterval(-INTERVAL_STEP_SECONDS))} onClick={() => this.handleClickAction(() => this.adjustInterval(-INTERVAL_STEP_SECONDS))} aria-label="5 saniye azalt">−</button>
                <div class="stepper-current">
                  <strong>{this.formatDuration(this.selectedSeconds)}</strong>
                  <span>DK : SN</span>
                </div>
                <button class="stepper-button" onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.adjustInterval(INTERVAL_STEP_SECONDS))} onClick={() => this.handleClickAction(() => this.adjustInterval(INTERVAL_STEP_SECONDS))} aria-label="5 saniye artır">+</button>
              </div>
              <div class="range-hint"><span>00:15</span><span>üst sınır 06:00</span></div>

              <div class="preset-label">HIZLI SEÇİM</div>
              <div class="preset-grid">
                <button class={`preset ${this.selectedSeconds === 30 ? 'selected' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.setIntervalDuration(30))} onClick={() => this.handleClickAction(() => this.setIntervalDuration(30))}>30 sn</button>
                <button class={`preset ${this.selectedSeconds === 35 ? 'selected' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.setIntervalDuration(35))} onClick={() => this.handleClickAction(() => this.setIntervalDuration(35))}>35 sn</button>
                <button class={`preset ${this.selectedSeconds === 40 ? 'selected' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.setIntervalDuration(40))} onClick={() => this.handleClickAction(() => this.setIntervalDuration(40))}>40 sn</button>
                <button class={`preset ${this.selectedSeconds === 45 ? 'selected' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.setIntervalDuration(45))} onClick={() => this.handleClickAction(() => this.setIntervalDuration(45))}>45 sn</button>
                <button class={`preset ${this.selectedSeconds === 50 ? 'selected' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.setIntervalDuration(50))} onClick={() => this.handleClickAction(() => this.setIntervalDuration(50))}>50 sn</button>
              </div>
            </div>

            <div class="sound-card">
              <div class="sound-icon"><span class="sound-wave wave-one" /><span class="sound-wave wave-two" /><span class="sound-wave wave-three" /></div>
              <div class="sound-copy"><strong>Sesli geri sayım</strong><span>Son 5 saniyede başlar · son 2 saniyede hızlanır</span></div>
              <button class={`sound-toggle ${this.soundEnabled ? 'enabled' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.toggleSound())} onClick={() => this.handleClickAction(() => this.toggleSound())} aria-label={this.soundEnabled ? 'Sesi kapat' : 'Sesi aç'}><span /></button>
            </div>

            <div class="action-row">
              <button class={`primary-action ${this.isRunning ? 'running' : ''}`} onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.toggleTimer())} onClick={() => this.handleClickAction(() => this.toggleTimer())}>
                {this.isRunning ? 'Duraklat' : this.isPaused ? 'Devam et' : 'Döngüyü başlat'}
              </button>
              <button class="reset-action" onTouchStart={() => this.beginTouch()} onTouchMove={() => this.moveTouch()} onTouchEnd={() => this.handleTouchAction(() => this.resetTimer())} onClick={() => this.handleClickAction(() => this.resetTimer())}>SIFIRLA</button>
            </div>

            <div class="control-footnote"><span class="footnote-line" />İlk başlatmada sesi etkinleştirmek için dokun.</div>
          </div>
        </div>
        <div class="page-signature"><span>GEASTACK · TIMER STUDY</span><span>01 — 2026</span></div>
      </div>
    )
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  private formatDuration(totalSeconds: number): string {
    return this.formatTime(totalSeconds)
  }

  private adjustInterval(deltaSeconds: number): void {
    this.setIntervalDuration(this.selectedSeconds + deltaSeconds)
  }

  private handleTouchAction(action: () => void): void {
    if (this.touchMoved) {
      this.touchMoved = false
      return
    }
    this.suppressClickUntilMs = Date.now() + 500
    action()
  }

  private beginTouch(): void {
    this.touchMoved = false
    this.suppressClickUntilMs = 0
  }

  private moveTouch(): void {
    this.touchMoved = true
  }

  private handleClickAction(action: () => void): void {
    if (Date.now() < this.suppressClickUntilMs) return
    action()
  }

  private setIntervalDuration(seconds: number): void {
    const nextSeconds = Math.max(MIN_INTERVAL_SECONDS, Math.min(MAX_INTERVAL_SECONDS, seconds))
    this.selectedSeconds = nextSeconds
    this.remainingMs = nextSeconds * 1000
    this.lastAnnouncedSecond = nextSeconds
    if (this.isRunning) this.deadlineAtMs = Date.now() + this.remainingMs
    if (this.isPaused) this.isPaused = false
  }

  private toggleTimer(): void {
    if (this.isRunning) {
      this.pauseTimer()
      return
    }

    if (this.soundEnabled) this.ensureAudioContext()
    this.isRunning = true
    this.isPaused = false
    this.deadlineAtMs = Date.now() + this.remainingMs
    this.lastAnnouncedSecond = Math.ceil(this.remainingMs / 1000)
    this.intervalId = setInterval(() => this.pulse(), 50)
  }

  private pauseTimer(): void {
    this.remainingMs = Math.max(0, this.deadlineAtMs - Date.now())
    if (this.intervalId !== null) clearInterval(this.intervalId)
    this.intervalId = null
    this.isRunning = false
    this.isPaused = true
    this.flipStartedAtMs = 0
    this.hourglassRotation = this.hourglassFlipped ? 180 : 0
  }

  private resetTimer(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId)
    this.intervalId = null
    this.isRunning = false
    this.isPaused = false
    this.completedCycles = 0
    this.hourglassFlipped = false
    this.hourglassRotation = 0
    this.flipStartedAtMs = 0
    this.remainingMs = this.selectedSeconds * 1000
    this.lastAnnouncedSecond = this.selectedSeconds
  }

  private pulse(): void {
    const now = Date.now()
    let remaining = this.deadlineAtMs - now

    if (remaining <= 0) {
      const durationMs = this.selectedSeconds * 1000
      const cyclesElapsed = Math.floor(-remaining / durationMs) + 1
      this.completedCycles += cyclesElapsed
      this.hourglassFlipped = this.completedCycles % 2 === 1
      this.flipFromDegrees = this.hourglassFlipped ? 0 : 180
      this.flipStartedAtMs = now
      this.deadlineAtMs += cyclesElapsed * durationMs
      remaining = this.deadlineAtMs - now
      this.playCycleSound()
      this.lastAnnouncedSecond = this.selectedSeconds
    }

    this.remainingMs = Math.max(0, remaining)
    if (this.flipStartedAtMs > 0) {
      const progress = Math.min(1, (now - this.flipStartedAtMs) / 550)
      const eased = progress * progress * (3 - 2 * progress)
      this.hourglassRotation = this.flipFromDegrees + 180 * eased
      if (progress >= 1) this.flipStartedAtMs = 0
    }
    const secondsLeft = Math.ceil(this.remainingMs / 1000)
    if (secondsLeft > 0 && secondsLeft <= 5 && secondsLeft !== this.lastAnnouncedSecond) {
      this.playCountdownSound(secondsLeft)
      this.lastAnnouncedSecond = secondsLeft
    }
  }

  private toggleSound(): void {
    this.soundEnabled = !this.soundEnabled
    if (this.soundEnabled) this.ensureAudioContext()
  }

  private ensureAudioContext(): boolean {
    if (this.hasAudioContext) return true
    if (typeof __gea_audioContext === 'undefined') {
      this.soundEnabled = false
      return false
    }
    this.hasAudioContext = true
    return true
  }

  private playTone(frequency: number, durationMs: number): void {
    if (!this.soundEnabled) return
    if (!this.ensureAudioContext()) return

    const context = __gea_audioContext
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(context.destination)
    const startsAt = context.currentTime
    oscillator.start(startsAt)
    oscillator.stop(startsAt + durationMs / 1000)
  }

  private playCountdownSound(secondsLeft: number): void {
    const frequency = 520 + (5 - secondsLeft) * 70
    this.playTone(frequency, secondsLeft <= 2 ? 150 : 100)
    if (secondsLeft <= 2) setTimeout(() => this.playTone(frequency + 180, 120), 155)
  }

  private playCycleSound(): void {
    this.playTone(880, 180)
    setTimeout(() => this.playTone(660, 170), 160)
    setTimeout(() => this.playTone(990, 260), 320)
  }
}

mount(App)
