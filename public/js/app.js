/**
 * Ambients - Main Application Orchestrator v3
 * Glues WebSockets, Session Timer, Dual Tasks HUD, Marks Tracker,
 * Flow Pet Companion, Exam Trajectory, Flashcards Co-Op,
 * 30-Day Heatmap, Soundscapes, Binaural Beats, and Dual Scratchpad with KaTeX.
 */

import { wsClient } from './ws-client.js';
import { timer } from './timer.js';
import { taskManager } from './tasks.js';
import { marksTracker } from './marks.js';
import { presenceManager } from './presence.js';
import { nudgeManager } from './nudges.js';
import { scratchpadManager } from './scratchpad.js';
import { debriefManager } from './debrief.js';
import { zenManager } from './zen.js';
import { companionManager } from './companion.js';
import { examManager } from './exam.js';
import { flashcardManager } from './flashcards.js';
import { heatmapManager } from './heatmap.js';
import { geminiAI } from './ai.js';
import { audio } from './audio.js';
import { storage } from './storage.js';
import { authManager } from './auth.js';
import { overseerManager } from './chat.js';
import { themeFX } from './particles.js';
import { renderIcons } from './icons.js';
import { landingManager } from './landing.js';
import { mediaManager } from './media.js';
import { rtcManager } from './rtc.js';

class AmbientsApp {
  constructor() {
    this.roomId = this.resolveRoomId();
    this.userProfile = storage.getProfile();
  }

  async init() {
    // 0. User Authentication & Multi-User State
    try {
      await authManager.init();
    } catch (e) {
      console.warn('[App] AuthManager init warning:', e);
    }

    // 1. Landing & Onboarding
    try {
      landingManager.init();
    } catch (e) {
      console.warn('[App] LandingManager init warning:', e);
    }

    // 2. Storage & Metrics
    try {
      this.initMetrics();
    } catch (e) {
      console.warn('[App] Metrics init warning:', e);
    }

    // 3. Mount All UI Modules & Particle FX
    try {
      themeFX.init();
      window.themeFX = themeFX;
    } catch (e) {
      console.warn('[App] ThemeFX init warning:', e);
    }

    try {
      this.mountDOM();
    } catch (e) {
      console.warn('[App] MountDOM warning:', e);
    }

    // 4. Connect to Realtime room
    try {
      this.connectRoom(this.roomId);
    } catch (e) {
      console.warn('[App] ConnectRoom warning:', e);
    }

    // 5. Global Keyboard Shortcuts
    this.setupKeyboardShortcuts();

    // 6. Soundscapes & Binaural Beats Mixer
    this.setupAudioSettingsModal();
    this.setupSoundscapeMixer();

    // 7. Desk View Switchers (Tasks vs Marks)
    this.setupDeskTabSwitchers();

    // 8. Room Share Controls
    this.setupRoomShareControls();

    // 9. Gemini AI Feature Bindings & Overseer Chat
    this.setupGeminiAI();
    try {
      overseerManager.init();
    } catch (e) {
      console.warn('[App] Overseer init warning:', e);
    }

    // 10. Ambient Color Themes
    this.setupThemePicker();

    // Render Vector Icons
    renderIcons();
    setTimeout(() => renderIcons(), 100);
    setTimeout(() => renderIcons(), 400);
    window.refreshIcons = renderIcons;

    // 11. Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('[PWA] Service Worker registered!', reg.scope);
      }).catch(err => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
    }
  }

  resolveRoomId() {
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    if (hashParams.get('room')) return hashParams.get('room');
    if (hash && !hash.includes('=')) return hash;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('room')) return urlParams.get('room');

    // If no room is specified in URL, check if they have a saved room from a previous session
    const lastRoom = storage.getLastRoom();
    if (lastRoom) {
      window.location.hash = `room=${lastRoom}`;
      return lastRoom;
    }

    // Otherwise, they are a new visitor. We don't force a room yet.
    // The LandingManager will handle onboarding and assign a random room.
    return null;
  }

  connectRoom(roomId) {
    if (!roomId) return; // Wait for landing page
    
    this.roomId = roomId;
    storage.setLastRoom(roomId);

    const roomBadgeEl = document.getElementById('current-room-badge');
    if (roomBadgeEl) roomBadgeEl.textContent = roomId;

    wsClient.connect(this.roomId, {
      ...this.userProfile,
      marks: marksTracker.myMarks,
      companion: companionManager.companion,
      examTarget: examManager.examTarget
    });

    wsClient.onLatencyUpdate = (latency) => {
      const dot = document.getElementById('latency-dot');
      const text = document.getElementById('latency-text');
      if (dot && text) {
        text.textContent = `${latency}ms`;
        if (latency < 60) dot.className = 'ping-dot bg-emerald-400';
        else if (latency < 160) dot.className = 'ping-dot bg-amber-400';
        else dot.className = 'ping-dot bg-rose-400';
      }
    };

    wsClient.onConnectionStatusChange = (connected) => {
      const statusText = document.getElementById('connection-status-text');
      const dot = document.getElementById('latency-dot');
      if (statusText) {
        statusText.textContent = connected ? 'Connected' : 'Reconnecting...';
        statusText.className = connected ? 'text-slate-400 text-xs' : 'text-amber-400 text-xs animate-pulse';
      }
      if (dot && !connected) {
        dot.className = 'ping-dot bg-amber-400 animate-ping';
      }
    };

    wsClient.on('ROOM_FULL', (data) => {
      alert(data.message || 'Room is already full.');
    });
  }

  mountDOM() {
    window.ambientsApp = this;
    window.examManager = examManager;
    window.taskManager = taskManager;
    window.marksManager = marksTracker;
    window.companionManager = companionManager;
    window.heatmapManager = heatmapManager;
    window.geminiAI = geminiAI;
    window.flashcardManager = flashcardManager;

    // 1. Timer
    timer.mount({
      digits: document.getElementById('timer-digits'),
      toggleBtn: document.getElementById('timer-toggle-btn'),
      resetBtn: document.getElementById('timer-reset-btn'),
      linkToggleBtn: document.getElementById('timer-link-toggle-btn'),
      progressBar: document.getElementById('timer-progress-bar'),
      modeButtons: {
        '25m': document.getElementById('mode-25m'),
        '5m': document.getElementById('mode-5m'),
        '50m': document.getElementById('mode-50m'),
        'stopwatch': document.getElementById('mode-stopwatch')
      }
    });

    // 2. Tasks
    taskManager.mount({
      myTaskList: document.getElementById('my-task-list'),
      myTaskInput: document.getElementById('my-task-input'),
      myFocusInput: document.getElementById('my-focus-input'),
      myTaskCount: document.getElementById('my-task-count'),
      myProgressBar: document.getElementById('my-progress-bar'),
      myDeskCard: document.getElementById('my-desk-card'),

      partnerTaskList: document.getElementById('partner-task-list'),
      partnerFocusText: document.getElementById('partner-focus-text'),
      partnerTaskCount: document.getElementById('partner-task-count'),
      partnerProgressBar: document.getElementById('partner-progress-bar'),
      partnerDeskCard: document.getElementById('partner-desk-card')
    });

    // 3. Marks Tracker
    marksTracker.mount({
      myMarksList: document.getElementById('my-marks-list'),
      myMarksSummary: document.getElementById('my-marks-summary'),
      myMarksProgressBar: document.getElementById('my-marks-progress-bar'),
      addMarkForm: document.getElementById('add-mark-form'),
      openAddModalBtn: document.getElementById('open-add-mark-btn'),
      addModal: document.getElementById('add-mark-modal'),
      closeAddModalBtn: document.getElementById('close-add-mark-modal'),

      partnerMarksList: document.getElementById('partner-marks-list'),
      partnerMarksSummary: document.getElementById('partner-marks-summary'),
      partnerMarksProgressBar: document.getElementById('partner-marks-progress-bar')
    });

    // 4. Flow Pet Companion
    companionManager.mount({
      myCompanionIcon: document.getElementById('my-companion-icon'),
      myCompanionName: document.getElementById('my-companion-name'),
      myCompanionStage: document.getElementById('my-companion-stage'),
      myCompanionProgress: document.getElementById('my-companion-progress'),
      waterBtn: document.getElementById('water-companion-btn'),

      partnerCompanionIcon: document.getElementById('partner-companion-icon'),
      partnerCompanionName: document.getElementById('partner-companion-name'),
      partnerCompanionStage: document.getElementById('partner-companion-stage')
    });

    // 5. Exam Manager
    examManager.mount({
      countdownText: document.getElementById('exam-countdown-text'),
      examTitle: document.getElementById('exam-title-display'),
      targetScore: document.getElementById('exam-target-score-display'),
      sparklineSvg: document.getElementById('exam-sparkline-svg'),
      modal: document.getElementById('exam-modal'),
      openModalBtn: document.getElementById('open-exam-btn'),
      closeModalBtn: document.getElementById('close-exam-modal'),
      form: document.getElementById('exam-target-form')
    });

    // 6. Flashcards Drill
    flashcardManager.mount({
      modal: document.getElementById('flashcards-modal'),
      openModalBtn: document.getElementById('open-flashcards-btn'),
      closeModalBtn: document.getElementById('close-flashcards-modal'),
      card: document.getElementById('flashcard-card'),
      cardFront: document.getElementById('flashcard-front-content'),
      cardBack: document.getElementById('flashcard-back-content'),
      deckSelect: document.getElementById('flashcard-deck-select'),
      progressText: document.getElementById('flashcard-progress-text'),
      progressBar: document.getElementById('flashcard-progress-bar'),
      correctBtn: document.getElementById('flashcard-correct-btn'),
      reviewBtn: document.getElementById('flashcard-review-btn'),
      flipBtn: document.getElementById('flashcard-flip-btn')
    });

    // 7. Heatmap Analytics
    heatmapManager.mount({
      modal: document.getElementById('heatmap-modal'),
      openModalBtn: document.getElementById('open-heatmap-btn'),
      closeModalBtn: document.getElementById('close-heatmap-modal'),
      gridContainer: document.getElementById('heatmap-grid'),
      totalMinsText: document.getElementById('heatmap-total-mins'),
      subjectBreakdown: document.getElementById('heatmap-subject-breakdown')
    });

    // 8. Presence
    presenceManager.mount({
      statusSelect: document.getElementById('my-status-select'),
      myAvatar: document.getElementById('my-avatar'),
      myName: document.getElementById('my-name-input'),
      myTabStatusDot: document.getElementById('my-tab-status-dot'),
      myTabStatusText: document.getElementById('my-tab-status-text'),

      partnerDeskCard: document.getElementById('partner-desk-card'),
      partnerAvatar: document.getElementById('partner-avatar'),
      partnerName: document.getElementById('partner-name'),
      partnerStatusBadge: document.getElementById('partner-status-badge'),
      partnerTabStatusDot: document.getElementById('partner-tab-status-dot'),
      partnerTabStatusText: document.getElementById('partner-tab-status-text'),
      partnerEmptyState: document.getElementById('partner-empty-state'),
      partnerContent: document.getElementById('partner-content')
    });

    // 9. Nudges
    nudgeManager.mount({
      dock: document.getElementById('nudge-dock'),
      targetDesk: document.getElementById('partner-desk-card'),
      toastContainer: document.getElementById('toast-container')
    });

    // 10. Dual Scratchpad with KaTeX
    scratchpadManager.mount({
      sharedTabBtn: document.getElementById('tab-shared-scratchpad'),
      personalTabBtn: document.getElementById('tab-personal-scratchpad'),
      textarea: document.getElementById('scratchpad-textarea'),
      preview: document.getElementById('scratchpad-preview'),
      typingIndicator: document.getElementById('scratchpad-typing-indicator'),
      previewToggleBtn: document.getElementById('scratchpad-preview-toggle'),
      drawer: document.getElementById('scratchpad-drawer'),
      toggleDrawerBtn: document.getElementById('toggle-scratchpad-btn'),
      closeDrawerBtn: document.getElementById('close-scratchpad-btn'),
      badgeDot: document.getElementById('scratchpad-badge-dot')
    });

    // 11. Debrief Modal
    debriefManager.mount({
      modal: document.getElementById('debrief-modal'),
      countdown: document.getElementById('debrief-countdown'),
      highFiveBtn: document.getElementById('debrief-high-five-btn'),
      skipToBreakBtn: document.getElementById('debrief-skip-btn')
    });

    // 12. Zen Mode
    zenManager.mount({
      overlay: document.getElementById('zen-overlay'),
      timerDigits: document.getElementById('zen-timer-digits'),
      myFocus: document.getElementById('zen-my-focus'),
      partnerFocus: document.getElementById('zen-partner-focus'),
      presenceDot: document.getElementById('zen-presence-dot'),
      exitBtn: document.getElementById('zen-exit-btn'),
      zenToggleBtn: document.getElementById('top-zen-btn')
    });

    // 13. Sync Lofi Player
    mediaManager.mount({
      playBtn: document.getElementById('media-play-btn'),
      volSlider: document.getElementById('media-vol-slider'),
      trackTitle: document.getElementById('media-track-title')
    });

    // 14. Voice Channels
    rtcManager.mount({
      joinBtn: document.getElementById('voice-join-btn')
    });

    // Tag & Effort selectors
    const tagSelect = document.getElementById('task-tag-select');
    const dotsSelect = document.getElementById('task-dots-select');
    if (tagSelect) {
      tagSelect.addEventListener('change', (e) => taskManager.selectedTag = e.target.value);
    }
    if (dotsSelect) {
      dotsSelect.addEventListener('change', (e) => taskManager.selectedDots = parseInt(e.target.value, 10));
    }
  }

  setupDeskTabSwitchers() {
    const tabMyTasksBtn = document.getElementById('tab-my-tasks-btn');
    const tabMyMarksBtn = document.getElementById('tab-my-marks-btn');
    const panelMyTasks = document.getElementById('panel-my-tasks');
    const panelMyMarks = document.getElementById('panel-my-marks');

    if (tabMyTasksBtn && tabMyMarksBtn) {
      tabMyTasksBtn.addEventListener('click', () => {
        tabMyTasksBtn.classList.add('active');
        tabMyMarksBtn.classList.remove('active');
        panelMyTasks.classList.remove('hidden');
        panelMyMarks.classList.add('hidden');
      });

      tabMyMarksBtn.addEventListener('click', () => {
        tabMyMarksBtn.classList.add('active');
        tabMyTasksBtn.classList.remove('active');
        panelMyMarks.classList.remove('hidden');
        panelMyTasks.classList.add('hidden');
      });
    }

    const tabPartnerTasksBtn = document.getElementById('tab-partner-tasks-btn');
    const tabPartnerMarksBtn = document.getElementById('tab-partner-marks-btn');
    const panelPartnerTasks = document.getElementById('panel-partner-tasks');
    const panelPartnerMarks = document.getElementById('panel-partner-marks');

    if (tabPartnerTasksBtn && tabPartnerMarksBtn) {
      tabPartnerTasksBtn.addEventListener('click', () => {
        tabPartnerTasksBtn.classList.add('active');
        tabPartnerMarksBtn.classList.remove('active');
        panelPartnerTasks.classList.remove('hidden');
        panelPartnerMarks.classList.add('hidden');
      });

      tabPartnerMarksBtn.addEventListener('click', () => {
        tabPartnerMarksBtn.classList.add('active');
        tabPartnerTasksBtn.classList.remove('active');
        panelPartnerMarks.classList.remove('hidden');
        panelPartnerTasks.classList.add('hidden');
      });
    }
  }

  setupSoundscapeMixer() {
    const mixerBtn = document.getElementById('soundscape-mixer-btn');
    const modal = document.getElementById('soundscape-modal');
    const closeModal = document.getElementById('close-soundscape-modal');

    const brownSlider = document.getElementById('slider-brown-noise');
    const rainSlider = document.getElementById('slider-rain-noise');
    const vinylSlider = document.getElementById('slider-vinyl-noise');
    const binauralSlider = document.getElementById('slider-binaural');

    const brownText = document.getElementById('brown-val-text');
    const rainText = document.getElementById('rain-val-text');
    const vinylText = document.getElementById('vinyl-val-text');
    const binauralText = document.getElementById('binaural-val-text');

    if (mixerBtn && modal) {
      mixerBtn.addEventListener('click', () => modal.classList.toggle('hidden'));
    }
    if (closeModal && modal) {
      closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (brownSlider) {
      brownSlider.value = audio.ambientState.brown || 0;
      if (brownText) brownText.textContent = `${Math.round(brownSlider.value * 100)}%`;
      brownSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.setAmbientLevel('brown', val);
        if (brownText) brownText.textContent = `${Math.round(val * 100)}%`;
      });
    }

    if (rainSlider) {
      rainSlider.value = audio.ambientState.rain || 0;
      if (rainText) rainText.textContent = `${Math.round(rainSlider.value * 100)}%`;
      rainSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.setAmbientLevel('rain', val);
        if (rainText) rainText.textContent = `${Math.round(val * 100)}%`;
      });
    }

    if (vinylSlider) {
      vinylSlider.value = audio.ambientState.vinyl || 0;
      if (vinylText) vinylText.textContent = `${Math.round(vinylSlider.value * 100)}%`;
      vinylSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.setAmbientLevel('vinyl', val);
        if (vinylText) vinylText.textContent = `${Math.round(val * 100)}%`;
      });
    }

    if (binauralSlider) {
      binauralSlider.value = audio.ambientState.binaural || 0;
      if (binauralText) binauralText.textContent = `${Math.round(binauralSlider.value * 100)}%`;
      binauralSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.setAmbientLevel('binaural', val);
        if (binauralText) binauralText.textContent = `${Math.round(val * 100)}%`;
      });
    }

    document.querySelectorAll('[data-binaural]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-binaural]').forEach(b => b.className = 'flex-1 py-1 rounded bg-white/5 text-[10px] font-mono text-slate-300 hover:bg-white/20');
        btn.className = 'flex-1 py-1 rounded bg-purple-500/30 text-[10px] font-mono text-white border border-purple-500/40';
        audio.setBinauralMode(btn.dataset.binaural);
      });
    });
  }

  setupAudioSettingsModal() {
    const audioToggleBtn = document.getElementById('audio-toggle-btn');
    const audioModal = document.getElementById('audio-modal');
    const closeAudioModal = document.getElementById('close-audio-modal');
    const volumeSlider = document.getElementById('audio-volume-slider');
    const muteCheckbox = document.getElementById('audio-mute-checkbox');
    const testChimeBtn = document.getElementById('test-chime-btn');
    const paletteSelect = document.getElementById('sound-palette-select');

    const updateAudioIcon = () => {
      if (audioToggleBtn) {
        const icon = audioToggleBtn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', audio.isMuted ? 'volume-x' : 'volume-2');
          if (window.lucide) window.lucide.createIcons();
        }
      }
    };

    if (audioToggleBtn) {
      audioToggleBtn.addEventListener('click', () => {
        if (audioModal) audioModal.classList.toggle('hidden');
      });
    }

    if (closeAudioModal) {
      closeAudioModal.addEventListener('click', () => {
        if (audioModal) audioModal.classList.add('hidden');
      });
    }

    if (volumeSlider) {
      volumeSlider.value = audio.volume;
      volumeSlider.addEventListener('input', (e) => audio.setVolume(parseFloat(e.target.value)));
    }

    if (muteCheckbox) {
      muteCheckbox.checked = audio.isMuted;
      muteCheckbox.addEventListener('change', (e) => {
        audio.setMuted(e.target.checked);
        updateAudioIcon();
      });
    }

    if (paletteSelect) {
      paletteSelect.value = audio.soundPalette || 'tibetan';
      paletteSelect.addEventListener('change', (e) => audio.setSoundPalette(e.target.value));
    }

    if (testChimeBtn) {
      testChimeBtn.addEventListener('click', () => audio.playFocusBell());
    }

    updateAudioIcon();
  }

  setupGeminiAI() {
    const aiBreakdownBtn = document.getElementById('ai-breakdown-btn');
    const focusInput = document.getElementById('my-focus-input');
    const aiGenDeckBtn = document.getElementById('ai-gen-deck-btn');
    const aiSocraticBtn = document.getElementById('ai-socratic-btn');
    const geminiKeyInput = document.getElementById('gemini-key-input');

    if (geminiKeyInput) {
      const savedKey = localStorage.getItem('ambients_gemini_key') || '';
      geminiKeyInput.value = savedKey;
      if (savedKey) geminiAI.setApiKey(savedKey);

      const saveKey = (val) => {
        const clean = (val || '').trim();
        if (clean) {
          localStorage.setItem('ambients_gemini_key', clean);
          geminiAI.setApiKey(clean);
          authManager.syncUserData({ geminiKey: clean });
          nudgeManager.showToast('✨ Gemini Key saved & connected!', 'info', 2000);
        } else {
          localStorage.removeItem('ambients_gemini_key');
          geminiAI.setApiKey('');
        }
      };

      geminiKeyInput.addEventListener('input', (e) => saveKey(e.target.value));
      geminiKeyInput.addEventListener('change', (e) => saveKey(e.target.value));
      geminiKeyInput.addEventListener('blur', (e) => saveKey(e.target.value));
    }

    if (aiBreakdownBtn && focusInput) {
      aiBreakdownBtn.addEventListener('click', () => {
        const goal = focusInput.value || prompt('Enter your focus goal to decompose:');
        if (goal) geminiAI.breakdownFocusGoal(goal);
      });
    }

    if (aiGenDeckBtn) {
      aiGenDeckBtn.addEventListener('click', () => {
        const topic = prompt('Enter a topic for AI active recall flashcards (e.g. Calculus Taylor Series):', 'Stokes Theorem');
        if (topic) {
          geminiAI.generateFlashcards(topic, 'general');
        }
      });
    }

    if (aiSocraticBtn) {
      aiSocraticBtn.addEventListener('click', () => {
        const textarea = document.getElementById('scratchpad-textarea');
        const context = textarea ? textarea.value : '';
        const question = prompt('What concept or derivation are you stuck on?', 'How do I proceed with this problem?');
        if (question) {
          geminiAI.getSocraticHint(context, question);
        }
      });
    }
  }

  setupThemePicker() {
    const savedTheme = storage.getTheme() || 'nextjs';
    this.applyTheme(savedTheme);

    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.themeBtn;
        this.applyTheme(theme);
        themeFX.spawnTaskCelebration(window.innerWidth / 2, window.innerHeight / 2);
        nudgeManager.showToast(`Theme changed to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`, 'info', 1500);
      });
    });
  }

  applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    storage.saveTheme(themeName);
    authManager.syncUserData({ theme: themeName });

    const themeLabel = document.getElementById('current-theme-name');
    if (themeLabel) {
      themeLabel.textContent = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    }

    // Update active ring on buttons
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      if (btn.dataset.themeBtn === themeName) {
        btn.classList.add('border-sky-400', 'bg-white/15', 'ring-2', 'ring-sky-400/60');
        btn.classList.remove('border-white/10');
      } else {
        btn.classList.remove('border-sky-400', 'bg-white/15', 'ring-2', 'ring-sky-400/60');
        btn.classList.add('border-white/10');
      }
    });
  }

  initMetrics() {
    window.appMetrics = {
      updateMetricsUI: () => {
        const m = storage.getMetrics();
        const streakEl = document.getElementById('metric-streak-count');
        const tasksEl = document.getElementById('metric-tasks-count');
        const minsEl = document.getElementById('metric-focus-mins');

        if (streakEl) streakEl.textContent = `${m.streak || 1}d`;
        if (tasksEl) tasksEl.textContent = `${m.todayCompletedTasks || 0}`;
        if (minsEl) minsEl.textContent = `${m.todayFocusMinutes || 0}m`;
      }
    };
    window.appMetrics.updateMetricsUI();
  }

  setupRoomShareControls() {
    const copyLinkBtn = document.getElementById('copy-invite-btn');
    const changeRoomBtn = document.getElementById('change-room-btn');

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}#room=${this.roomId}`;
        navigator.clipboard.writeText(url).then(() => {
          nudgeManager.showToast('📋 Study room link copied to clipboard!', 'info', 2500);
        }).catch(() => {
          prompt('Copy this study room link to share with your partner:', url);
        });
      });
    }

    if (changeRoomBtn) {
      changeRoomBtn.addEventListener('click', () => {
        const newRoom = prompt('Enter a room code to join or create:', this.roomId);
        if (newRoom && newRoom.trim() && newRoom.trim() !== this.roomId) {
          const clean = newRoom.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
          window.location.hash = `room=${clean}`;
          window.location.reload();
        }
      });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable;

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        timer.toggleRunState();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const focusInput = document.getElementById('my-focus-input');
        if (focusInput) focusInput.focus();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const taskInput = document.getElementById('my-task-input');
        if (taskInput) taskInput.focus();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        scratchpadManager.toggleDrawer();
        return;
      }

      if (e.key.toLowerCase() === 'm' && !isInput && !e.ctrlKey && !e.metaKey) {
        audio.setMuted(!audio.isMuted);
        const muteChk = document.getElementById('audio-mute-checkbox');
        if (muteChk) muteChk.checked = audio.isMuted;
        const icon = document.getElementById('audio-toggle-btn')?.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', audio.isMuted ? 'volume-x' : 'volume-2');
          if (window.lucide) window.lucide.createIcons();
        }
        nudgeManager.showToast(audio.isMuted ? '🔇 Audio muted' : '🔊 Audio unmuted', 'info', 1500);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AmbientsApp();
  app.init();
});
