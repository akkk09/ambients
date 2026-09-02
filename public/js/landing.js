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
    this.fetchPublicLobbies();
  }

  async fetchPublicLobbies() {
    try {
      const res = await fetch('/api/rooms/active');
      const data = await res.json();
      this.renderLobbies(data.rooms || []);
    } catch (e) {
      console.warn('Failed to fetch lobbies:', e);
    }
  }

  renderLobbies(rooms) {
    let container = document.getElementById('landing-lobbies');
    if (!container) {
      // Create it if it doesn't exist
      const interactiveBox = document.querySelector('#landing-hero .max-w-md');
      if (!interactiveBox) return;
      container = document.createElement('div');
      container.id = 'landing-lobbies';
      container.className = 'mt-5 flex flex-col gap-2 w-full text-left';
      interactiveBox.appendChild(container);
    }

    if (rooms.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-500 text-center py-2">No public lobbies active right now. Start one above!</div>`;
      return;
    }

    container.innerHTML = `
      <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Live Public Lobbies</div>
      ${rooms.map(room => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors" onclick="document.getElementById('landing-room-input').value = '${room.id}'; document.getElementById('landing-enter-btn').click();">
          <span class="text-xs font-mono text-sky-400">#${room.id}</span>
          <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Join</span>
        </div>
      `).join('')}
    `;
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
