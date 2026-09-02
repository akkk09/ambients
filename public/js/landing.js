/**
 * Ambients - Landing Page & Interactive Onboarding Controller
 * Provides first-time visitors with an elegant intro, room customizer, and quick-start guide.
 */

export class LandingManager {
  constructor() {
    this.heroEl = null;
    this.roomInput = null;
    this.randomRoomBtn = null;
    this.enterBtn = null;
    this.soloBtn = null;
    this.guideModal = null;
  }

  init() {
    this.heroEl = document.getElementById('landing-hero');
    this.roomInput = document.getElementById('landing-room-input');
    this.randomRoomBtn = document.getElementById('landing-random-btn');
    this.enterBtn = document.getElementById('landing-enter-btn');
    this.soloBtn = document.getElementById('landing-solo-btn');
    this.guideModal = document.getElementById('guide-modal');

    // Check if user has already onboarded or wants to bypass
    const hasOnboarded = localStorage.getItem('ambients_onboarded') === 'true';
    const hasDirectRoom = window.location.hash.includes('room=') || window.location.search.includes('room=');

    if (hasOnboarded || hasDirectRoom) {
      this.hideLanding(true);
    } else {
      this.showLanding();
    }

    this.bindEvents();
  }

  showLanding() {
    if (!this.heroEl) return;
    this.heroEl.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    if (this.roomInput && !this.roomInput.value) {
      this.roomInput.value = this.generateRandomRoom();
    }
  }

  hideLanding(instant = false) {
    if (!this.heroEl) return;
    document.body.classList.remove('overflow-hidden');

    if (instant) {
      this.heroEl.classList.add('hidden');
    } else {
      this.heroEl.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
      setTimeout(() => {
        this.heroEl.classList.add('hidden');
      }, 400);
    }
  }

  generateRandomRoom() {
    const adjectives = ['calm', 'quiet', 'deep', 'steady', 'gentle', 'ambient', 'silent', 'zen'];
    const nouns = ['haven', 'desk', 'zone', 'grove', 'flow', 'orbit', 'focus', 'space'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${Math.floor(10 + Math.random() * 90)}`;
  }

  bindEvents() {
    // Randomize room name
    if (this.randomRoomBtn && this.roomInput) {
      this.randomRoomBtn.addEventListener('click', () => {
        this.roomInput.value = this.generateRandomRoom();
        if (window.renderIcons) window.renderIcons();
      });
    }

    // Enter Room CTA
    if (this.enterBtn && this.roomInput) {
      this.enterBtn.addEventListener('click', () => {
        const targetRoom = (this.roomInput.value.trim() || this.generateRandomRoom()).toLowerCase();
        localStorage.setItem('ambients_onboarded', 'true');
        window.location.hash = `room=${targetRoom}`;
        this.hideLanding();

        if (window.ambientsApp && typeof window.ambientsApp.connectRoom === 'function') {
          window.ambientsApp.connectRoom(targetRoom);
        }
      });
    }

    // Solo Mode CTA
    if (this.soloBtn) {
      this.soloBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const soloRoom = 'solo-' + Math.floor(100 + Math.random() * 900);
        localStorage.setItem('ambients_onboarded', 'true');
        window.location.hash = `room=${soloRoom}`;
        this.hideLanding();

        if (window.ambientsApp && typeof window.ambientsApp.connectRoom === 'function') {
          window.ambientsApp.connectRoom(soloRoom);
        }
      });
    }

    // Nav "Tour / Guide" button re-opener
    const guideBtn = document.getElementById('nav-guide-btn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        this.openGuideModal();
      });
    }

    // Close guide modal
    const closeGuideBtn = document.getElementById('close-guide-btn');
    if (closeGuideBtn) {
      closeGuideBtn.addEventListener('click', () => {
        this.closeGuideModal();
      });
    }
  }

  openGuideModal() {
    if (this.guideModal) {
      this.guideModal.classList.remove('hidden');
      if (window.renderIcons) window.renderIcons();
    }
  }

  closeGuideModal() {
    if (this.guideModal) {
      this.guideModal.classList.add('hidden');
    }
  }
}

export const landingManager = new LandingManager();
