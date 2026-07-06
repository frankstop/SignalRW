# Signal Runner Web 🌐👾

A high-fidelity HTML5 Web Port of the retro-vector survival arena game **Signal Runner** (originally compiled for macOS). Rebuilt from the ground up using modern web technologies, procedural audio synthesis, and sleek canvas graphics.

🎮 **Play the Web Version:** Run locally or host on GitHub Pages!

---

## 🚀 Key Features

*   **HTML5 Canvas Render Loop:** High-performance, crisp 2D vector graphic outlines with custom neon shadow glows.
*   **Procedural Audio Synthesis:** Dynamic, retro 8-bit sound effects (shooting, dashing, explosions, hits, and game-over melodies) synthesized on-the-fly using the browser's native **Web Audio API**—zero audio assets or load delay!
*   **Aesthetic CRT Bezel Overlay:** A retro arcade-cabinet framing, complete with curved scanline filters and glowing borders.
*   **State-of-the-Art Upgrades System:** Scale your bandwidth with up to 10 upgradable modules:
    *   **Shotgun Burst (Up to Level 5):** Fires an angled spread of bullets dynamically (launching a massive **11 projectiles** at max level).
    *   **Bigger Bullets:** Increases projectile hitbox and scales impact damage proportionally (`radius / 4.0`).
    *   **Electric Aura:** Emits periodic electric pulses damaging glitches caught inside.
    *   **Burn Trail Dash:** Dash leaves behind a trail of orange signal flames damaging any glitches they touch.
    *   *And more (Max HP, speed, fire-rate, magnet pickup range, pierce, dash cooldown).*

---

## 🕹️ Controls

| Control | Action |
| :--- | :--- |
| **W A S D** | Move Character |
| **ARROW KEYS** | Aim & Fire (8 directions) |
| **SHIFT** | Aim-Lock (strafes character while keeping firing direction) |
| **SPACE** | Dash (provides brief invulnerability, damages glitches) |
| **1, 2, 3** | Choose Upgrades (during Level Up screen) |
| **P / ESC** | Pause Game |
| **M** | Mute / Unmute Audio |
| **F** | Toggle Fullscreen |

---

## 🛠️ Run Locally

You can launch and edit the game using Vite:

1.  **Clone the repository** (if not already local)
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start development server:**
    ```bash
    npm run dev
    ```
4.  **Open in browser:** Access the local address (typically `http://localhost:3000` or `http://localhost:5173`).

---

## 🧬 Project Architecture

*   `index.html` - Game overlay markup, HUD overlay, and screens (Title, Upgrade Select, Pause, Death Screen).
*   `index.css` - Theme styling, CRT scanline gradients, custom typography (`Orbitron` & `Space Mono`), and animations.
*   `game.js` - Central game loops, physics collision engines, state phases, camera lerps, and vector shapes.
*   `audio.js` - Procedural audio tone synthesizers.

---
*Keep the signal alive. The line must not break.* 📶
