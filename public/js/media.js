/**
 * Ambients - Synchronized Media Player (YouTube Lofi)
 * Embeds a hidden/mini YouTube iframe and synchronizes playback state 
 * with the study partner via Ably real-time.
 */

import { wsClient } from './ws-client.js';
import { nudgeManager } from './nudges.js';

export class MediaManager {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.videoId = 'jfKfPfyJRdk'; // Default: Lofi Girl stream
    this.isPlaying = false;
    this.isLinked = true;
    this.volume = 50;

    // UI
    this.playBtn = null;
    this.volSlider = null;
    this.trackTitle = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.playBtn = elements.playBtn;
    this.volSlider = elements.volSlider;
    this.trackTitle = elements.trackTitle;

    this.bindEvents();
    this.loadYouTubeAPI();
  }

  loadYouTubeAPI() {
    if (window.YT) {
      this.initPlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => this.initPlayer();
  }

  initPlayer() {
    this.player = new YT.Player('youtube-player', {
      height: '0',
      width: '0',
      videoId: this.videoId,
      playerVars: {
        'playsinline': 1,
        'controls': 0,
        'disablekb': 1,
        'autoplay': 0
      },
      events: {
        'onReady': this.onPlayerReady.bind(this),
        'onStateChange': this.onPlayerStateChange.bind(this)
      }
    });
  }

  onPlayerReady(event) {
    this.isReady = true;
    event.target.setVolume(this.volume);
    console.log('[Media] YouTube Player Ready');
  }

  onPlayerStateChange(event) {
    if (!this.isLinked) return;

    // Broadcast state to partner
    if (event.data == YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this.broadcastState('play');
    } else if (event.data == YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this.broadcastState('pause');
    }
    this.updateUI();
  }

  bindEvents() {
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => {
        if (!this.isReady) return;
        if (this.isPlaying) {
          this.player.pauseVideo();
        } else {
          this.player.playVideo();
        }
      });
    }

    if (this.volSlider) {
      this.volSlider.addEventListener('input', (e) => {
        this.volume = parseInt(e.target.value, 10);
        if (this.isReady) this.player.setVolume(this.volume);
      });
    }
  }

  initWebSocketListeners() {
    wsClient.on('MEDIA_SYNC', (data) => {
      if (!this.isLinked || !this.isReady) return;

      if (data.action === 'play' && !this.isPlaying) {
        this.isPlaying = true;
        this.player.playVideo();
        nudgeManager.showToast('📻 Partner resumed the music', 'info', 1500);
      } else if (data.action === 'pause' && this.isPlaying) {
        this.isPlaying = false;
        this.player.pauseVideo();
        nudgeManager.showToast('📻 Partner paused the music', 'info', 1500);
      } else if (data.action === 'change_track') {
        this.videoId = data.videoId;
        this.player.loadVideoById(this.videoId);
        this.isPlaying = true;
        nudgeManager.showToast('📻 Partner changed the music station', 'info', 1500);
      }
      this.updateUI();
    });
  }

  broadcastState(action) {
    wsClient.send('MEDIA_ACTION', {
      action: action,
      videoId: this.videoId,
      time: this.isReady ? this.player.getCurrentTime() : 0
    });
  }

  updateUI() {
    if (!this.playBtn) return;
    const icon = this.playBtn.querySelector('i');
    if (this.isPlaying) {
      this.playBtn.classList.add('text-sky-400');
      if (icon) icon.setAttribute('data-lucide', 'pause');
    } else {
      this.playBtn.classList.remove('text-sky-400');
      if (icon) icon.setAttribute('data-lucide', 'play');
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

export const mediaManager = new MediaManager();
window.mediaManager = mediaManager;
