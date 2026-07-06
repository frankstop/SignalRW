// Audio Service for Signal Runner Web
// Dynamic sound effects synthesized procedurally using Web Audio API

class AudioService {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    // Try to load muted preference from localStorage
    try {
      this.isMuted = localStorage.getItem('signalRunner.muted') === 'true';
    } catch (e) {
      this.isMuted = false;
    }
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('signalRunner.muted', this.isMuted);
    } catch (e) {}
    return this.isMuted;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(cue) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      switch (cue) {
        case 'shoot':
          this.playShoot();
          break;
        case 'kill':
          this.playKill();
          break;
        case 'pickup':
          this.playPickup();
          break;
        case 'levelUp':
          this.playLevelUp();
          break;
        case 'dash':
          this.playDash();
          break;
        case 'hurt':
          this.playHurt();
          break;
        case 'gameOver':
          this.playGameOver();
          break;
      }
    } catch (err) {
      console.warn("Audio synthesis error:", err);
    }
  }

  // Shoot sound: Quick high-pitch sweep down with pulse wave
  playShoot() {
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.12);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  // Kill sound: Low retro explosion (noise + frequency sweep down)
  playKill() {
    const time = this.ctx.currentTime;
    const duration = 0.25;
    
    // Generate white noise buffer
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to sweep down
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(80, time + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
    noise.stop(time + duration);

    // Add a quick bass thump oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.linearRampToValueAtTime(40, time + 0.15);
    oscGain.gain.setValueAtTime(0.1, time);
    oscGain.gain.linearRampToValueAtTime(0.01, time + 0.15);
    
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  // Pickup sound: Upward frequency sweep (sine wave)
  playPickup() {
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(900, time + 0.08);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  // Level up sound: Upward arpeggio (square/triangle wave notes)
  playLevelUp() {
    const time = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    const noteDuration = 0.07;

    notes.forEach((freq, index) => {
      const startTime = time + index * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  // Dash sound: High-pass filtered noise whoosh
  playDash() {
    const time = this.ctx.currentTime;
    const duration = 0.18;
    
    // Generate noise buffer
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(3000, time + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.01, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
    noise.stop(time + duration);
  }

  // Hurt sound: Low crunchy sound (sawtooth wave sweeping down)
  playHurt() {
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.linearRampToValueAtTime(60, time + 0.2);

    // Distortion or quick vibrato
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    vibrato.frequency.value = 45;
    vibratoGain.gain.value = 30;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.01, time + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    vibrato.start(time);
    osc.start(time);
    
    vibrato.stop(time + 0.2);
    osc.stop(time + 0.2);
  }

  // Game over sound: Sad descending arpeggio (sawtooth + pitch drop)
  playGameOver() {
    const time = this.ctx.currentTime;
    const notes = [293.66, 277.18, 261.63, 220.00, 196.00, 164.81]; // D4, C#4, C4, A3, G3, E3
    const noteDuration = 0.12;

    notes.forEach((freq, index) => {
      const startTime = time + index * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + 0.25);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, startTime);
      filter.frequency.linearRampToValueAtTime(150, startTime + 0.25);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  }
}

export const audio = new AudioService();
