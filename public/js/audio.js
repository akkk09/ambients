/**
 * Ambients - Procedural Web Audio Synthesizer & Soundscape Generator v3
 * 
 * Features:
 * 1. Procedural Ambient Generators: Brown Noise, Soft Rain, Vinyl Crackle
 * 2. Stereo Binaural Beats & Brainwave Tuner (Gamma 40Hz, Beta 20Hz, Alpha 10Hz, Theta 6Hz)
 * 3. Sound Palettes for Session Bells: Tibetan Bowl, Zen Gong, Rhodes Chord, Wooden Marimba
 * 4. Micro-nudge chimes & Task completion sounds
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.volume = 0.7;
    this.soundPalette = 'tibetan'; // 'tibetan' | 'gong' | 'rhodes' | 'marimba'

    // Ambient soundscape levels (0.0 to 1.0)
    this.ambientState = {
      brown: 0,
      rain: 0,
      vinyl: 0,
      binaural: 0,
      binauralMode: 'gamma' // 'gamma' (40Hz), 'beta' (20Hz), 'alpha' (10Hz), 'theta' (6Hz)
    };

    this.ambientNodes = {
      brownSource: null,
      brownGain: null,
      rainSource: null,
      rainGain: null,
      vinylSource: null,
      vinylGain: null,
      binauralLeftOsc: null,
      binauralRightOsc: null,
      binauralGain: null,
    };

    this.loadPreferences();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupAmbientSoundscapes();
      this.setupBinauralBeats();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  loadPreferences() {
    try {
      const savedMute = localStorage.getItem('ambients_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';
      const savedVol = localStorage.getItem('ambients_volume');
      if (savedVol !== null) this.volume = parseFloat(savedVol);
      const savedPalette = localStorage.getItem('ambients_palette');
      if (savedPalette) this.soundPalette = savedPalette;

      const savedAmbients = localStorage.getItem('ambients_soundscapes');
      if (savedAmbients) {
        this.ambientState = { ...this.ambientState, ...JSON.parse(savedAmbients) };
      }
    } catch (e) {
      console.warn('[AudioEngine] Could not load audio preferences');
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('ambients_muted', this.isMuted.toString());
      localStorage.setItem('ambients_volume', this.volume.toString());
      localStorage.setItem('ambients_palette', this.soundPalette);
      localStorage.setItem('ambients_soundscapes', JSON.stringify(this.ambientState));
    } catch (e) {}
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.savePreferences();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.savePreferences();
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setSoundPalette(palette) {
    this.soundPalette = palette;
    this.savePreferences();
  }

  // =========================================================================
  // 1. PROCEDURAL SOUNDSCAPES
  // =========================================================================

  setupAmbientSoundscapes() {
    if (!this.ctx) return;

    // A. Brown Noise
    const bufferSize = this.ctx.sampleRate * 4;
    const brownBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = brownBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const brownSource = this.ctx.createBufferSource();
    brownSource.buffer = brownBuffer;
    brownSource.loop = true;

    const brownFilter = this.ctx.createBiquadFilter();
    brownFilter.type = 'lowpass';
    brownFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

    const brownGain = this.ctx.createGain();
    brownGain.gain.setValueAtTime(this.ambientState.brown * 0.35, this.ctx.currentTime);

    brownSource.connect(brownFilter);
    brownFilter.connect(brownGain);
    brownGain.connect(this.masterGain);
    brownSource.start(0);

    this.ambientNodes.brownSource = brownSource;
    this.ambientNodes.brownGain = brownGain;

    // B. Soft Rain
    const rainBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const rainData = rainBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      rainData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    rainFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(this.ambientState.rain * 0.3, this.ctx.currentTime);

    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.masterGain);
    rainSource.start(0);

    this.ambientNodes.rainSource = rainSource;
    this.ambientNodes.rainGain = rainGain;

    // C. Vinyl Crackle
    const vinylBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const vinylData = vinylBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < 0.0008) {
        vinylData[i] = (Math.random() * 2 - 1) * 0.6;
      } else {
        vinylData[i] = (Math.random() * 2 - 1) * 0.008;
      }
    }

    const vinylSource = this.ctx.createBufferSource();
    vinylSource.buffer = vinylBuffer;
    vinylSource.loop = true;

    const vinylFilter = this.ctx.createBiquadFilter();
    vinylFilter.type = 'highpass';
    vinylFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    const vinylGain = this.ctx.createGain();
    vinylGain.gain.setValueAtTime(this.ambientState.vinyl * 0.25, this.ctx.currentTime);

    vinylSource.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(this.masterGain);
    vinylSource.start(0);

    this.ambientNodes.vinylSource = vinylSource;
    this.ambientNodes.vinylGain = vinylGain;
  }

  // =========================================================================
  // 2. STEREO BINAURAL BEATS & BRAINWAVE TUNER
  // =========================================================================

  setupBinauralBeats() {
    if (!this.ctx) return;

    const baseFreq = 216; // Pure carrier harmonic
    const offsetMap = { gamma: 40, beta: 20, alpha: 10, theta: 6 };
    const beatOffset = offsetMap[this.ambientState.binauralMode] || 40;

    const leftOsc = this.ctx.createOscillator();
    const rightOsc = this.ctx.createOscillator();
    leftOsc.type = 'sine';
    rightOsc.type = 'sine';

    leftOsc.frequency.setValueAtTime(baseFreq - (beatOffset / 2), this.ctx.currentTime);
    rightOsc.frequency.setValueAtTime(baseFreq + (beatOffset / 2), this.ctx.currentTime);

    // Stereo Panning
    const leftPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const rightPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    if (leftPanner) leftPanner.pan.setValueAtTime(-1, this.ctx.currentTime);
    if (rightPanner) rightPanner.pan.setValueAtTime(1, this.ctx.currentTime);

    const binauralGain = this.ctx.createGain();
    binauralGain.gain.setValueAtTime(this.ambientState.binaural * 0.25, this.ctx.currentTime);

    if (leftPanner && rightPanner) {
      leftOsc.connect(leftPanner);
      leftPanner.connect(binauralGain);

      rightOsc.connect(rightPanner);
      rightPanner.connect(binauralGain);
    } else {
      leftOsc.connect(binauralGain);
      rightOsc.connect(binauralGain);
    }

    binauralGain.connect(this.masterGain);

    leftOsc.start(0);
    rightOsc.start(0);

    this.ambientNodes.binauralLeftOsc = leftOsc;
    this.ambientNodes.binauralRightOsc = rightOsc;
    this.ambientNodes.binauralGain = binauralGain;
  }

  setBinauralMode(mode) {
    this.initContext();
    this.ambientState.binauralMode = mode;
    this.savePreferences();

    if (!this.ctx || !this.ambientNodes.binauralLeftOsc || !this.ambientNodes.binauralRightOsc) return;

    const baseFreq = 216;
    const offsetMap = { gamma: 40, beta: 20, alpha: 10, theta: 6 };
    const beatOffset = offsetMap[mode] || 40;

    this.ambientNodes.binauralLeftOsc.frequency.setTargetAtTime(baseFreq - (beatOffset / 2), this.ctx.currentTime, 0.1);
    this.ambientNodes.binauralRightOsc.frequency.setTargetAtTime(baseFreq + (beatOffset / 2), this.ctx.currentTime, 0.1);
  }

  setAmbientLevel(type, level) {
    this.initContext();
    const clamped = Math.max(0, Math.min(1, level));
    this.ambientState[type] = clamped;
    this.savePreferences();

    if (!this.ctx) return;

    if (type === 'brown' && this.ambientNodes.brownGain) {
      this.ambientNodes.brownGain.gain.setTargetAtTime(clamped * 0.35, this.ctx.currentTime, 0.05);
    } else if (type === 'rain' && this.ambientNodes.rainGain) {
      this.ambientNodes.rainGain.gain.setTargetAtTime(clamped * 0.3, this.ctx.currentTime, 0.05);
    } else if (type === 'vinyl' && this.ambientNodes.vinylGain) {
      this.ambientNodes.vinylGain.gain.setTargetAtTime(clamped * 0.25, this.ctx.currentTime, 0.05);
    } else if (type === 'binaural' && this.ambientNodes.binauralGain) {
      this.ambientNodes.binauralGain.gain.setTargetAtTime(clamped * 0.25, this.ctx.currentTime, 0.05);
    }
  }

  // =========================================================================
  // 3. FOCUS BELL SOUND PALETTES
  // =========================================================================

  playFocusBell() {
    this.initContext();
    if (this.isMuted || !this.ctx) return;

    switch (this.soundPalette) {
      case 'gong':
        this.playZenGong();
        break;
      case 'rhodes':
        this.playRhodesChord();
        break;
      case 'marimba':
        this.playBreakChime();
        break;
      case 'tibetan':
      default:
        this.playTibetanBowl();
    }
  }

  playTibetanBowl() {
    const now = this.ctx.currentTime;
    const baseFreq = 432;
    const partials = [
      { freqRatio: 1.0, gain: 0.5, decay: 4.5 },
      { freqRatio: 2.76, gain: 0.25, decay: 3.2 },
      { freqRatio: 5.40, gain: 0.12, decay: 2.0 },
      { freqRatio: 8.93, gain: 0.06, decay: 1.4 }
    ];

    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * p.freqRatio, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(p.gain, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + p.decay + 0.1);
    });
  }

  playZenGong() {
    const now = this.ctx.currentTime;
    const fundamental = 164.81;

    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fundamental, now);
    osc.frequency.exponentialRampToValueAtTime(fundamental * 0.98, now + 4);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(fundamental * 2.14, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 5.2);
    subOsc.stop(now + 5.2);
  }

  playRhodesChord() {
    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.00, 493.88, 587.33];

    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);

      gain.gain.setValueAtTime(0, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.22, now + i * 0.04 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + i * 0.04);
      osc.stop(now + 3.2);
    });
  }

  playBreakChime() {
    this.initContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const stepTime = 0.12;

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * stepTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.3, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 1.3);
    });
  }

  playTaskDing() {
    this.initContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760.0, now + 0.06);
    gain2.gain.setValueAtTime(0.25, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.45);
  }

  playNudgeSound(nudgeType) {
    this.initContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;

    switch (nudgeType) {
      case 'fistbump': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case 'coffee': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case 'sparkle': {
        const freqs = [1046.5, 1318.5, 1567.9, 2093.0];
        freqs.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + i * 0.05;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 0.35);
        });
        break;
      }
      case 'bolt': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'water': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(1900, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case 'celebrate': {
        const chord = [523.25, 659.25, 783.99, 1046.5];
        chord.forEach(f => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.65);
        });
        break;
      }
      default:
        this.playTaskDing();
    }
  }
}

export const audio = new AudioEngine();
