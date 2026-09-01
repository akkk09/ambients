# Ambients ☕⚡

> **Ambient Remote Study & Co-Working Platform**
> A lightweight, real-time ambient study & co-working web app designed for two people to study together remotely without intrusive video or audio feeds, fostering subtle accountability, shared pacing, and micro-encouragement.

---

## ✨ Key Features

### 1. 🎨 6 Website-Wide Structural Theme Engines
Transform the entire visual aesthetic, layout, animations, and particle physics across the app:
- **🌌 Next.js Minimalist Dark** *(Default)*: Vercel-style `#000000` pitch black, 1px dot grid matrix, sharp 10px corners, GSAP-style cubic-bezier transitions (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **🌸 Bubble Pink & Confetti**: Bubbly rounded cards (`rounded-3xl`), pill buttons, soft pastel candy pink, bouncy jelly physics (`@keyframes jelly-bounce`), and interactive confetti + floating heart bubbles on task completions & nudges.
- **📟 Cyberpunk Matrix Terminal**: Terminal CRT phosphor green (`#10b981`), tech brackets `[ 25:00 ]`, scanline overlay, and cyber neon sparks.
- **☕ Lo-Fi Cafe Roast**: Warm vintage cafe sepia paper, rich roasted mocha cards, golden amber borders, and soothing steam particle ambience.
- **✨ Nordic Twilight Aurora**: Iridescent frosted glassmorphism (`backdrop-blur-2xl`) with cosmic star-dust particles.
- **🍃 Zen Matcha Bamboo**: Earthy bamboo sage (`#84cc16`), organic leafy curves, and serene breathe pacing.

---

### 2. 🤖 Gemini AI Focus Overseer & Agentic Chatbar (`⌘/`)
- **Direct Desk Control**: The AI Overseer converses with you and directly executes actions in your study workspace:
  - ⚡ *Add / Complete / Delete Tasks*: Creates micro-tasks with estimated effort dots (`• 15m`, `•• 30m`, `••• 45m`).
  - ⏱️ *Session Timer & Ambient Sounds*: Sets Pomodoro modes (`25m`, `50m`, `5m`) and activates soundscapes (Rain, Brown noise, Binaural beats).
  - 🎯 *Focus Goal & Exam Targets*: Updates focus text and tracks exam dates and target percentages.
  - 🃏 *AI Flashcard Generation*: Creates active recall flashcard decks with LaTeX formulas ($...$ and $$...$$).

---

### 3. 🔐 User Accounts & Multi-User Persistence
- **Authentication System**: Lightweight Login / Register / Logout modal with token authentication.
- **Account-Specific Data Sync**:
  - 📅 **Exam Targets & Sparkline Trajectory**
  - 📈 **30-Day Consistency Heatmap & Daily Focus Minute Logs**
  - 🔑 **Custom Gemini API Key**
  - 💬 **Overseer Chat History**
  - 📋 **Micro-Tasks & Test Marks**
  - 🌱 **Flow Pet Companion Progress & XP**

---

### 4. ⏱️ Synchronized Session Timer (Pomodoro / Stopwatch)
- **4 Operational Modes**: `25m Focus`, `5m Break`, `50m Deep Block`, `Stopwatch`.
- **Shared WebSocket State Machine**: Instant broadcast with server timestamp drift compensation.
- **Procedural Soundscapes & Bells**: Synthesizes Tibetan singing bowls, temple gongs, Rhodes piano chords, and wooden marimbas using the Web Audio API (zero external MP3 files).
- **Stereo Binaural Beats**: Gamma (40Hz), Beta (20Hz), Alpha (10Hz), and Theta (6Hz).

---

### 5. 🧮 KaTeX LaTeX Math & Dual Scratchpad (`⌘J`)
- **KaTeX LaTeX Math Rendering**: Renders inline `$formula$` and block `$$display$$` math across flashcards and notes.
- **Dual Shared & Private Scratchpad**: Real-time collaborative shared notes alongside private scratchpad.
- **Formula Quick-Insert Toolbar**: Integrals ($\int$), Derivatives ($\frac{d}{dx}$), Matrices ($[Matrix]$), Sums ($\sum$), Reactions ($\rightarrow$), and Accents.

---

### 6. 🌱 Flow Pet Desk Companion & Spaced Repetition Flashcards
- **Ambient Flow Pet**: Level 1 (Tiny Sprout) to Level 4 (Celestial Tree) that grows and levels up with your focus minutes and completed tasks.
- **Duo Flashcards Drill**: 3D flippable cards with accuracy tracking and live partner HUD.
- **30-Day Activity Heatmap**: GitHub-style consistency grid visualizing daily study habit formation.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd ambients

# Install dependencies
npm install

# Start the server
node server.js
```

Open `http://localhost:3000` in your browser. Share the room link (`#room=...`) with your study partner to co-work in real time!

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla JavaScript (ES Modules), Tailwind CSS, KaTeX (LaTeX Math), Lucide Icons, Web Audio API procedural synthesis.
- **Backend**: Node.js, Express, Native `ws` WebSockets.
- **AI**: Google GenAI SDK (`@google/genai` with `gemini-3.7-flash`).

---

## 📄 License
MIT License. Built for distraction-free remote co-working & academic focus.
