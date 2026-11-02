// A tiny WebAudio instrument: every click, clink and chime is synthesised, so
// the game ships no audio files. The context is created only after a gesture,
// which keeps browser autoplay rules happy.

type Tone = {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  delay?: number
  slideTo?: number
}

const MELODY = [392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0, 523.25]
const BASS = [196.0, 220.0, 246.94, 174.61]

export class AudioManager {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private timer: number | null = null
  private step = 0
  soundOn = true
  musicOn = true

  unlock(): void {
    if (typeof window === 'undefined') return
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }
    const Ctor = window.AudioContext
    if (!Ctor) return
    this.context = new Ctor()
    this.master = this.context.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.context.destination)
    this.sfx = this.context.createGain()
    this.sfx.gain.value = 1
    this.sfx.connect(this.master)
    this.music = this.context.createGain()
    this.music.gain.value = 0.16
    this.music.connect(this.master)
    if (this.musicOn) this.startMusic()
  }

  configure(options: { sound: boolean; music: boolean }): void {
    this.soundOn = options.sound
    this.musicOn = options.music
    if (this.musicOn) this.startMusic()
    else this.stopMusic()
  }

  private tone(tone: Tone): void {
    if (!this.soundOn || !this.context || !this.sfx) return
    const start = this.context.currentTime + (tone.delay ?? 0)
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = tone.type
    osc.frequency.setValueAtTime(tone.frequency, start)
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, tone.slideTo), start + tone.duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
    osc.connect(gain)
    gain.connect(this.sfx)
    osc.start(start)
    osc.stop(start + tone.duration + 0.04)
  }

  tap(): void {
    this.tone({ frequency: 540, duration: 0.055, type: 'sine', gain: 0.13 })
  }

  select(): void {
    this.tone({ frequency: 680, duration: 0.08, type: 'triangle', gain: 0.16 })
    this.tone({ frequency: 920, duration: 0.09, type: 'sine', gain: 0.09, delay: 0.045 })
  }

  place(): void {
    this.tone({ frequency: 300, duration: 0.09, type: 'square', gain: 0.07, slideTo: 420 })
    this.tone({ frequency: 760, duration: 0.16, type: 'triangle', gain: 0.14, delay: 0.035 })
    this.tone({ frequency: 1140, duration: 0.2, type: 'sine', gain: 0.06, delay: 0.06 })
  }

  remove(): void {
    this.tone({ frequency: 420, duration: 0.12, type: 'triangle', gain: 0.11, slideTo: 240 })
  }

  engage(): void {
    this.tone({ frequency: 180, duration: 0.12, type: 'square', gain: 0.08, slideTo: 320 })
    this.tone({ frequency: 620, duration: 0.1, type: 'sine', gain: 0.08, delay: 0.06 })
  }

  error(): void {
    this.tone({ frequency: 210, duration: 0.18, type: 'sawtooth', gain: 0.08, slideTo: 150 })
    this.tone({ frequency: 168, duration: 0.2, type: 'square', gain: 0.05, delay: 0.07 })
  }

  hint(): void {
    this.tone({ frequency: 880, duration: 0.1, type: 'sine', gain: 0.1 })
    this.tone({ frequency: 1174, duration: 0.14, type: 'sine', gain: 0.08, delay: 0.08 })
  }

  motor(): void {
    this.tone({ frequency: 120, duration: 0.3, type: 'sawtooth', gain: 0.05, slideTo: 180 })
    this.tone({ frequency: 240, duration: 0.36, type: 'triangle', gain: 0.06, delay: 0.05 })
  }

  bloom(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((frequency, index) =>
      this.tone({ frequency, duration: 0.4, type: 'triangle', gain: 0.15, delay: index * 0.09 }),
    )
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, index) =>
      this.tone({ frequency, duration: 0.38, type: 'triangle', gain: 0.14, delay: index * 0.12 }),
    )
  }

  private startMusic(): void {
    if (!this.musicOn || !this.context || this.timer !== null) return
    this.timer = window.setInterval(() => this.musicTick(), 640)
  }

  private stopMusic(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private musicTick(): void {
    if (!this.context || !this.music || !this.musicOn) return
    const context = this.context
    const start = context.currentTime
    const note = MELODY[this.step % MELODY.length]!
    const bass = BASS[Math.floor(this.step / 4) % BASS.length]!
    const voice = context.createOscillator()
    const gain = context.createGain()
    voice.type = 'triangle'
    voice.frequency.value = note
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62)
    voice.connect(gain)
    gain.connect(this.music)
    voice.start(start)
    voice.stop(start + 0.66)

    const low = context.createOscillator()
    const lowGain = context.createGain()
    low.type = 'sine'
    low.frequency.value = bass
    lowGain.gain.setValueAtTime(0.0001, start)
    lowGain.gain.exponentialRampToValueAtTime(0.03, start + 0.1)
    lowGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    low.connect(lowGain)
    lowGain.connect(this.music)
    low.start(start)
    low.stop(start + 0.95)
    this.step += 1
  }
}

export const audio = new AudioManager()
