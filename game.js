// Signal Runner Web - Game Engine
import { audio } from './audio.js';
import { analytics } from './analytics.js';

// Configuration
const ARENA_WIDTH = 1800;
const ARENA_HEIGHT = 1200;
const BASE_PLAYER_SPEED = 220;
const BASE_FIRE_INTERVAL = 350; // ms
const BASE_DASH_COOLDOWN = 2000; // ms
const DASH_DURATION = 150; // ms
const DASH_SPEED_MULTIPLIER = 3.5;
const INVULNERABILITY_DURATION = 1000; // ms
const SCREEN_SHAKE_DECAY = 0.9;

// Color Palette (resolved for Canvas rendering compatibility)
const COLORS = {
  blue: '#00f2fe',
  purple: '#9b51e0',
  green: '#39ff14',
  orange: '#ff9f1c',
  red: '#ff3366',
  yellow: '#fffb00',
  white: '#ffffff',
  gray: '#1a1a2e'
};

// Upgrades Definition
const UPGRADES = {
  maxHP: { title: "+1 max HP", detail: "Heal and increase capacity", max: 5 },
  movement: { title: "Faster movement", detail: "+12% movement speed", max: 5 },
  fireRate: { title: "Faster shooting", detail: "Shoot 15% faster", max: 5 },
  bulletSize: { title: "Bigger bullets", detail: "+25% projectile size", max: 5 },
  pierce: { title: "Bullet pierces +1", detail: "Shots pass through one more target", max: 5 },
  dashCooldown: { title: "Dash cooldown reduced", detail: "Dash recharges 18% faster", max: 5 },
  pickupRadius: { title: "XP pickup radius", detail: "+35% shard attraction", max: 5 },
  shotgun: { title: "Shotgun burst", detail: "Fire angled spread shots", max: 5 },
  aura: { title: "Electric aura", detail: "Damage nearby glitches", max: 3 },
  burnTrail: { title: "Burn trail dash", detail: "Dash leaves a damaging signal trail", max: 3 }
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // UI elements
    this.titleScreen = document.getElementById('title-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.levelupScreen = document.getElementById('levelup-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.flashOverlay = document.getElementById('flash-overlay');
    
    // HUD element references
    this.hpVal = document.getElementById('hud-hp-val');
    this.scoreVal = document.getElementById('hud-score-val');
    this.levelVal = document.getElementById('hud-level-val');
    this.dashVal = document.getElementById('hud-dash-val');
    this.xpFill = document.getElementById('hud-xp-fill');
    
    // Game state
    this.phase = 'title'; // title, playing, paused, levelUp, gameOver
    this.score = 0;
    this.highScore = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 10;
    this.timeElapsed = 0;
    this.isNewHighScore = false;
    
    // Entities
    this.player = {
      x: 0,
      y: 0,
      radius: 12,
      hp: 3,
      maxHP: 3,
      moveSpeed: BASE_PLAYER_SPEED,
      fireInterval: BASE_FIRE_INTERVAL,
      bulletRadius: 4,
      bulletPierce: 1,
      dashCooldown: BASE_DASH_COOLDOWN,
      pickupRadius: 60,
      shotgunLevel: 0,
      auraLevel: 0,
      burnTrailLevel: 0,
      
      // Dynamic states
      vx: 0,
      vy: 0,
      invulnTimer: 0,
      dashTimer: 0, // time left in current dash
      dashCooldownTimer: 0, // time left before next dash
      dashVx: 0,
      dashVy: 0,
      
      // Upgrades levels tracker
      upgrades: {
        maxHP: 0,
        movement: 0,
        fireRate: 0,
        bulletSize: 0,
        pierce: 0,
        dashCooldown: 0,
        pickupRadius: 0,
        shotgun: 0,
        aura: 0,
        burnTrail: 0
      }
    };
    
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.shards = [];
    this.particles = [];
    this.burnTrails = []; // signal fire from dash
    
    // Input state
    this.keys = {};
    this.lastAim = { x: 0, y: -1 }; // last aim vector (defaults to up)
    this.aimLocked = false;
    
    // Gamepad state
    this.gamepadConnected = false;
    this.prevGamepadButtons = [];
    this.gamepadInput = {
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      dash: false,
      lockDash: false
    };
    this.toastTimeout = null;
    
    // Touch joystick state
    this.touchControls = {
      left: {
        active: false,
        touchId: null,
        startPos: { x: 0, y: 0 },
        input: { x: 0, y: 0 }
      },
      right: {
        active: false,
        touchId: null,
        startPos: { x: 0, y: 0 },
        input: { x: 0, y: 0 }
      }
    };
    
    // Timers
    this.lastTime = 0;
    this.lastShotAt = 0;
    this.lastSpawnAt = 0;
    this.lastAuraPulseAt = 0;
    this.lastTrailSpawnAt = 0;
    
    // Visual Effects
    this.screenShake = 0;
    this.camera = { x: 0, y: 0 };
    this.flashOpacity = 0;
    this.flashColor = '#ffffff';
    
    // Available upgrades selection for level-up menu
    this.levelUpOptions = [];
    this.selectedUpgradeOrder = [];
    
    // Load high score
    try {
      this.highScore = parseInt(localStorage.getItem('signalRunner.highScore')) || 0;
    } catch (e) {
      this.highScore = 0;
    }
    
    this.setupEvents();
    this.resizeCanvas();
    
    // Start animation loop
    requestAnimationFrame((t) => this.loop(t));
  }
  
  setupEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad);
      this.gamepadConnected = true;
      this.showGamepadToast(e.gamepad.id);
      this.updateUpgradeKeys();
    });
    
    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('Gamepad disconnected:', e.gamepad);
      this.gamepadConnected = false;
      this.showGamepadToast(null);
      this.updateUpgradeKeys();
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Prevent scrolling behaviors for game keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      
      if (this.phase === 'title') {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.startGame();
        }
      } else if (this.phase === 'playing') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          this.pauseGame();
        }
        if (e.code === 'KeyM') {
          this.toggleMute();
        }
        if (e.code === 'KeyF') {
          this.toggleFullScreen();
        }
      } else if (this.phase === 'paused') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          this.resumeGame();
        }
        if (e.code === 'KeyM') {
          this.toggleMute();
        }
      } else if (this.phase === 'levelUp') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') this.chooseUpgrade(0);
        else if (e.code === 'Digit2' || e.code === 'Numpad2') this.chooseUpgrade(1);
        else if (e.code === 'Digit3' || e.code === 'Numpad3') this.chooseUpgrade(2);
      } else if (this.phase === 'gameOver') {
        if (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter') {
          this.startGame();
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Upgrade click triggers
    document.getElementById('upgrade-1').addEventListener('click', () => this.chooseUpgrade(0));
    document.getElementById('upgrade-2').addEventListener('click', () => this.chooseUpgrade(1));
    document.getElementById('upgrade-3').addEventListener('click', () => this.chooseUpgrade(2));

    // Setup Virtual Joysticks
    const leftJoy = document.getElementById('joystick-left');
    const leftKnob = document.getElementById('joystick-left-knob');
    const rightJoy = document.getElementById('joystick-right');
    const rightKnob = document.getElementById('joystick-right-knob');
    
    const handleJoystickStart = (joyEl, knobEl, stateObj, touchEvent) => {
      touchEvent.preventDefault();
      const rect = joyEl.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      
      const touch = touchEvent.changedTouches[0];
      stateObj.active = true;
      stateObj.touchId = touch.identifier;
      stateObj.startPos = center;
    };
    
    const handleJoystickMove = (joyEl, knobEl, stateObj, touchEvent) => {
      if (!stateObj.active) return;
      
      let activeTouch = null;
      for (let i = 0; i < touchEvent.touches.length; i++) {
        if (touchEvent.touches[i].identifier === stateObj.touchId) {
          activeTouch = touchEvent.touches[i];
          break;
        }
      }
      
      if (!activeTouch) return;
      
      const dx = activeTouch.clientX - stateObj.startPos.x;
      const dy = activeTouch.clientY - stateObj.startPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = 40; // Max drag distance
      
      let finalDx = dx;
      let finalDy = dy;
      
      if (dist > maxRadius) {
        finalDx = (dx / dist) * maxRadius;
        finalDy = (dy / dist) * maxRadius;
      }
      
      knobEl.style.transform = `translate(calc(-50% + ${finalDx}px), calc(-50% + ${finalDy}px))`;
      
      stateObj.input.x = finalDx / maxRadius;
      stateObj.input.y = finalDy / maxRadius;
    };
    
    const handleJoystickEnd = (joyEl, knobEl, stateObj, touchEvent) => {
      let isEnded = false;
      for (let i = 0; i < touchEvent.changedTouches.length; i++) {
        if (touchEvent.changedTouches[i].identifier === stateObj.touchId) {
          isEnded = true;
          break;
        }
      }
      
      if (!isEnded) return;
      
      stateObj.active = false;
      stateObj.touchId = null;
      stateObj.input = { x: 0, y: 0 };
      knobEl.style.transform = 'translate(-50%, -50%)';
    };
    
    if (leftJoy && leftKnob) {
      leftJoy.addEventListener('touchstart', (e) => handleJoystickStart(leftJoy, leftKnob, this.touchControls.left, e), { passive: false });
      window.addEventListener('touchmove', (e) => handleJoystickMove(leftJoy, leftKnob, this.touchControls.left, e), { passive: false });
      window.addEventListener('touchend', (e) => handleJoystickEnd(leftJoy, leftKnob, this.touchControls.left, e));
      window.addEventListener('touchcancel', (e) => handleJoystickEnd(leftJoy, leftKnob, this.touchControls.left, e));
    }
    
    if (rightJoy && rightKnob) {
      rightJoy.addEventListener('touchstart', (e) => handleJoystickStart(rightJoy, rightKnob, this.touchControls.right, e), { passive: false });
      window.addEventListener('touchmove', (e) => handleJoystickMove(rightJoy, rightKnob, this.touchControls.right, e), { passive: false });
      window.addEventListener('touchend', (e) => handleJoystickEnd(rightJoy, rightKnob, this.touchControls.right, e));
      window.addEventListener('touchcancel', (e) => handleJoystickEnd(rightJoy, rightKnob, this.touchControls.right, e));
    }
    
    // Tap buttons triggers
    const btnDash = document.getElementById('btn-dash');
    if (btnDash) {
      btnDash.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys['Space'] = true;
      });
      btnDash.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys['Space'] = false;
      });
    }
    
    const btnLock = document.getElementById('btn-lock');
    if (btnLock) {
      btnLock.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.aimLocked = !this.aimLocked;
        if (this.aimLocked) {
          btnLock.classList.add('locked');
        } else {
          btnLock.classList.remove('locked');
        }
      });
    }

    // Screen touch clicks
    this.titleScreen.addEventListener('click', () => {
      if (this.phase === 'title') this.startGame();
    });
    this.titleScreen.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.phase === 'title') this.startGame();
    });
    
    this.gameoverScreen.addEventListener('click', () => {
      if (this.phase === 'gameOver') this.startGame();
    });
    this.gameoverScreen.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.phase === 'gameOver') this.startGame();
    });

    // Interactive HUD pause and mute
    const pauseBtn = document.getElementById('hud-pause-btn');
    if (pauseBtn) {
      const togglePause = () => {
        if (this.phase === 'playing') this.pauseGame();
        else if (this.phase === 'paused') this.resumeGame();
      };
      pauseBtn.addEventListener('click', togglePause);
      pauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        togglePause();
      });
    }
    
    const muteBtn = document.getElementById('hud-mute-state');
    if (muteBtn) {
      const toggleMute = () => {
        this.toggleMute();
      };
      muteBtn.addEventListener('click', toggleMute);
      muteBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleMute();
      });
    }
  }
  
  pollGamepad(dt, timestamp) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gp = gamepads[i];
        break;
      }
    }
    
    if (!gp) {
      if (this.gamepadConnected) {
        this.gamepadConnected = false;
        this.showGamepadToast(null);
        this.updateUpgradeKeys();
      }
      return;
    }
    
    if (!this.gamepadConnected) {
      this.gamepadConnected = true;
      this.showGamepadToast(gp.id);
      this.updateUpgradeKeys();
    }
    
    // Helper function for button state queries
    const btnPressed = (index) => gp.buttons[index] && gp.buttons[index].pressed;
    const btnJustPressed = (index) => {
      const pressed = gp.buttons[index] && gp.buttons[index].pressed;
      const prev = this.prevGamepadButtons[index];
      return pressed && !prev;
    };
    
    // 1. Process movement axes (Left Stick + D-pad)
    const deadzone = 0.15;
    let mx = gp.axes[0];
    let my = gp.axes[1];
    if (Math.abs(mx) < deadzone) mx = 0;
    if (Math.abs(my) < deadzone) my = 0;
    
    // D-Pad override
    if (gp.buttons[12] && gp.buttons[12].pressed) my = -1; // Up
    if (gp.buttons[13] && gp.buttons[13].pressed) my = 1;  // Down
    if (gp.buttons[14] && gp.buttons[14].pressed) mx = -1; // Left
    if (gp.buttons[15] && gp.buttons[15].pressed) mx = 1;  // Right
    
    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my);
      const scale = len > 1 ? 1 / len : 1;
      this.gamepadInput.move.x = mx * scale;
      this.gamepadInput.move.y = my * scale;
    } else {
      this.gamepadInput.move.x = 0;
      this.gamepadInput.move.y = 0;
    }
    
    // 2. Process aiming axes (Right Stick)
    let ax = gp.axes[2];
    let ay = gp.axes[3];
    if (Math.abs(ax) < deadzone) ax = 0;
    if (Math.abs(ay) < deadzone) ay = 0;
    this.gamepadInput.aim.x = ax;
    this.gamepadInput.aim.y = ay;
    
    // 3. Process discrete buttons based on active phase
    if (this.phase === 'title') {
      if (btnJustPressed(0) || btnJustPressed(9)) { // A button or Start
        this.startGame();
      }
    } else if (this.phase === 'gameOver') {
      if (btnJustPressed(0) || btnJustPressed(9)) { // A button or Start
        this.startGame();
      }
    } else if (this.phase === 'paused') {
      if (btnJustPressed(9) || btnJustPressed(8)) { // Start or Back
        this.resumeGame();
      }
      if (btnJustPressed(3)) { // Y Button toggles mute
        this.toggleMute();
      }
    } else if (this.phase === 'levelUp') {
      if (btnJustPressed(0)) { // A selects option 1
        this.chooseUpgrade(0);
        this.gamepadInput.lockDash = true;
      } else if (btnJustPressed(1)) { // B selects option 2
        this.chooseUpgrade(1);
        this.gamepadInput.lockDash = true;
      } else if (btnJustPressed(2)) { // X selects option 3
        this.chooseUpgrade(2);
        this.gamepadInput.lockDash = true;
      }
    } else if (this.phase === 'playing') {
      if (btnJustPressed(9) || btnJustPressed(8)) { // Start or Back to Pause
        this.pauseGame();
      }
      if (btnJustPressed(3)) { // Y Button toggles mute
        this.toggleMute();
      }
      if (btnJustPressed(2)) { // X toggles Aim-Lock
        this.aimLocked = !this.aimLocked;
        const btnLock = document.getElementById('btn-lock');
        if (btnLock) {
          if (this.aimLocked) btnLock.classList.add('locked');
          else btnLock.classList.remove('locked');
        }
      }
    }
    
    // 4. Dash button detection
    // Dash triggers on A (button 0), RB (button 5), or RT (button 7)
    const dashPressed = btnPressed(0) || btnPressed(5) || (gp.buttons[7] && gp.buttons[7].value > 0.1);
    if (!dashPressed) {
      this.gamepadInput.lockDash = false;
    }
    this.gamepadInput.dash = dashPressed && !this.gamepadInput.lockDash;
    
    // Store current buttons for next frame's rising edge detection
    this.prevGamepadButtons = gp.buttons.map(b => b.pressed);
  }

  showGamepadToast(gamepadId) {
    const toast = document.getElementById('gamepad-toast');
    if (!toast) return;
    
    if (gamepadId) {
      let name = 'Controller';
      if (gamepadId.toLowerCase().includes('xbox')) {
        name = 'Xbox Controller';
      } else if (gamepadId.toLowerCase().includes('playstation') || gamepadId.toLowerCase().includes('wireless controller')) {
        name = 'PlayStation Controller';
      } else {
        const match = gamepadId.match(/^([^(]+)/);
        if (match) name = match[1].trim();
      }
      
      toast.innerText = `🎮 ${name.toUpperCase()} CONNECTED`;
      toast.classList.remove('disconnect');
      toast.classList.add('show');
    } else {
      toast.innerText = `🔌 CONTROLLER DISCONNECTED`;
      toast.classList.add('disconnect');
      toast.classList.add('show');
    }
    
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  updateUpgradeKeys() {
    if (this.phase !== 'levelUp') return;
    for (let i = 0; i < 3; i++) {
      const keyNode = document.querySelector(`#upgrade-${i + 1} .upgrade-key`);
      if (keyNode) {
        keyNode.innerText = this.gamepadConnected ? ['A', 'B', 'X'][i] : (i + 1);
      }
    }
  }
  
  resizeCanvas() {
    // Keep internal game rendering crisp (High DPI)
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentNode.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }
  
  toggleMute() {
    const isMuted = audio.toggleMute();
    const muteLabel = document.getElementById('hud-mute-state');
    if (muteLabel) {
      muteLabel.innerText = isMuted ? "MUTED" : "SOUND ON";
      muteLabel.style.color = isMuted ? "var(--neon-red)" : "rgba(255, 255, 255, 0.4)";
    }
  }

  toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  startGame() {
    audio.resume();
    audio.play('levelUp');
    
    // Clear menus
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.levelupScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    
    // Reset Stats
    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 10;
    this.timeElapsed = 0;
    this.isNewHighScore = false;
    this.selectedUpgradeOrder = [];
    
    analytics.startGame();
    
    // Reset Player
    this.player = {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      radius: 12,
      hp: 3,
      maxHP: 3,
      moveSpeed: BASE_PLAYER_SPEED,
      fireInterval: BASE_FIRE_INTERVAL,
      bulletRadius: 4,
      bulletPierce: 1,
      dashCooldown: BASE_DASH_COOLDOWN,
      pickupRadius: 65,
      shotgunLevel: 0,
      auraLevel: 0,
      burnTrailLevel: 0,
      
      vx: 0,
      vy: 0,
      invulnTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      dashVx: 0,
      dashVy: 0,
      
      upgrades: {
        maxHP: 0,
        movement: 0,
        fireRate: 0,
        bulletSize: 0,
        pierce: 0,
        dashCooldown: 0,
        pickupRadius: 0,
        shotgun: 0,
        aura: 0,
        burnTrail: 0
      }
    };
    
    // Clear arrays
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.shards = [];
    this.particles = [];
    this.burnTrails = [];
    
    this.lastShotAt = 0;
    this.lastSpawnAt = 0;
    this.lastAuraPulseAt = 0;
    this.lastTrailSpawnAt = 0;
    this.screenShake = 0;
    this.flashOpacity = 0;
    
    // Set view HUD
    this.updateHUD();
    
    this.phase = 'playing';
  }
  
  pauseGame() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.pauseScreen.classList.remove('hidden');
  }
  
  resumeGame() {
    if (this.phase !== 'paused') return;
    this.pauseScreen.classList.add('hidden');
    this.phase = 'playing';
    audio.resume();
  }
  
  triggerFlash(color, alpha = 0.5) {
    this.flashColor = color;
    this.flashOpacity = alpha;
    this.flashOverlay.style.backgroundColor = color;
    this.flashOverlay.style.opacity = alpha;
  }
  
  updateHUD() {
    this.hpVal.innerText = `${Math.ceil(this.player.hp)}/${this.player.maxHP}`;
    this.scoreVal.innerText = String(this.score).padStart(6, '0');
    this.levelVal.innerText = `LV.${this.level}`;
    
    // Dash status
    if (this.player.dashCooldownTimer > 0) {
      this.dashVal.innerText = `SPACE DASH ${(this.player.dashCooldownTimer / 1000).toFixed(1)}s`;
      this.dashVal.style.color = "rgba(255, 255, 255, 0.4)";
      this.dashVal.classList.remove('ready');
    } else {
      this.dashVal.innerText = "SPACE DASH READY";
      this.dashVal.style.color = "var(--neon-green)";
      this.dashVal.classList.add('ready');
    }
    
    // XP Fill Bar
    const xpPercent = Math.min(100, (this.xp / this.xpNeeded) * 100);
    this.xpFill.style.width = `${xpPercent}%`;
  }
  
  // Game Loop
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(100, timestamp - this.lastTime) / 1000; // clamp dt to avoid giant jumps
    this.lastTime = timestamp;
    
    this.pollGamepad(dt, timestamp);
    
    if (this.phase === 'playing') {
      this.update(dt, timestamp);
    }
    
    this.render();
    
    requestAnimationFrame((t) => this.loop(t));
  }
  
  update(dt, timestamp) {
    this.timeElapsed += dt;
    
    // Decays
    if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt * 1000;
    if (this.player.dashCooldownTimer > 0) this.player.dashCooldownTimer -= dt * 1000;
    if (this.screenShake > 0.1) this.screenShake *= SCREEN_SHAKE_DECAY;
    else this.screenShake = 0;
    
    if (this.flashOpacity > 0) {
      this.flashOpacity = Math.max(0, this.flashOpacity - dt * 5);
      this.flashOverlay.style.opacity = this.flashOpacity;
    }
    
    // 1. Player updates
    this.updatePlayer(dt);
    
    // 2. Weapons & shooting
    this.updateWeapons(timestamp);
    
    // 3. Spawning
    this.updateSpawning(timestamp);
    
    // 4. Update elements
    this.updateEntities(dt, timestamp);
    
    // 5. Collision checks
    this.checkCollisions(timestamp);
    
    // 6. Update HUD periodically
    this.updateHUD();
    
    // Update live session stats for early page exit tracking
    analytics.updateSessionStats(
      this.score,
      this.timeElapsed,
      this.kills,
      this.selectedUpgradeOrder.join(', ')
    );
  }
  
  updatePlayer(dt) {
    const p = this.player;
    
    // Handle active dash
    if (p.dashTimer > 0) {
      p.dashTimer -= dt * 1000;
      p.x += p.dashVx * dt;
      p.y += p.dashVy * dt;
      
      // Leave burn trail if upgrade is active
      if (p.burnTrailLevel > 0) {
        const now = Date.now();
        if (now - this.lastTrailSpawnAt > 25) {
          this.burnTrails.push({
            x: p.x,
            y: p.y,
            radius: 12 + p.burnTrailLevel * 3,
            timer: 2000 + p.burnTrailLevel * 500, // trail duration in ms
            maxTimer: 2000 + p.burnTrailLevel * 500,
            damage: 0.8 + p.burnTrailLevel * 0.4
          });
          this.lastTrailSpawnAt = now;
        }
      }
      
      // Clamp to arena
      this.clampPlayer();
      
      if (p.dashTimer <= 0) {
        // Dash ended
        p.vx = 0;
        p.vy = 0;
      }
      return; // Skip normal movement while dashing
    }
    
    // Gamepad movement, Touch controls movement, or keyboard input movement
    if (this.gamepadConnected && (Math.abs(this.gamepadInput.move.x) > 0.01 || Math.abs(this.gamepadInput.move.y) > 0.01)) {
      p.vx = this.gamepadInput.move.x * p.moveSpeed;
      p.vy = this.gamepadInput.move.y * p.moveSpeed;
    } else if (this.touchControls.left.active) {
      p.vx = this.touchControls.left.input.x * p.moveSpeed;
      p.vy = this.touchControls.left.input.y * p.moveSpeed;
    } else {
      let mx = 0;
      let my = 0;
      
      if (this.keys['KeyW']) my -= 1;
      if (this.keys['KeyS']) my += 1;
      if (this.keys['KeyA']) mx -= 1;
      if (this.keys['KeyD']) mx += 1;
      
      // Normalize movement vector
      if (mx !== 0 || my !== 0) {
        const len = Math.sqrt(mx * mx + my * my);
        p.vx = (mx / len) * p.moveSpeed;
        p.vy = (my / len) * p.moveSpeed;
      } else {
        p.vx = 0;
        p.vy = 0;
      }
    }
    
    // Dash initiation
    if ((this.keys['Space'] || (this.gamepadConnected && this.gamepadInput.dash)) && p.dashCooldownTimer <= 0) {
      // Dash in the direction of movement, or aim if not moving
      let dx = p.vx;
      let dy = p.vy;
      
      if (dx === 0 && dy === 0) {
        // If not moving, dash in the direction of last aim or keyboard shooting arrow key
        dx = this.lastAim.x;
        dy = this.lastAim.y;
      }
      
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        p.dashVx = (dx / len) * p.moveSpeed * DASH_SPEED_MULTIPLIER;
        p.dashVy = (dy / len) * p.moveSpeed * DASH_SPEED_MULTIPLIER;
        p.dashTimer = DASH_DURATION;
        p.dashCooldownTimer = p.dashCooldown;
        p.invulnTimer = DASH_DURATION + 100; // brief extra invulnerability
        audio.play('dash');
        this.screenShake = Math.max(this.screenShake, 5);
        this.spawnBurst(p.x, p.y, COLORS.blue, 15, 80);
      }
    }
    
    // Move player
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    this.clampPlayer();
  }
  
  clampPlayer() {
    const p = this.player;
    p.x = Math.max(p.radius + 10, Math.min(ARENA_WIDTH - p.radius - 10, p.x));
    p.y = Math.max(p.radius + 10, Math.min(ARENA_HEIGHT - p.radius - 10, p.y));
  }
  
  updateWeapons(timestamp) {
    const p = this.player;
    
    // Use touch controls or keyboard input or gamepad input for aim-shooting
    let isGamepadLockPressed = false;
    if (this.gamepadConnected) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          gp = gamepads[i];
          break;
        }
      }
      if (gp) {
        isGamepadLockPressed = (gp.buttons[4] && gp.buttons[4].pressed) || 
                               (gp.buttons[6] && gp.buttons[6].value > 0.1);
      }
    }

    const isShiftHeld = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const activeLock = this.aimLocked || isShiftHeld || isGamepadLockPressed;
    
    let shootDir = null;
    
    if (this.gamepadConnected && (Math.abs(this.gamepadInput.aim.x) > 0.2 || Math.abs(this.gamepadInput.aim.y) > 0.2)) {
      const rx = this.gamepadInput.aim.x;
      const ry = this.gamepadInput.aim.y;
      const dist = Math.sqrt(rx * rx + ry * ry);
      
      if (dist > 0.25) {
        this.lastAim = { x: rx / dist, y: ry / dist };
        if (!activeLock) {
          shootDir = this.lastAim;
        }
      }
    } else if (this.touchControls.right.active) {
      const rx = this.touchControls.right.input.x;
      const ry = this.touchControls.right.input.y;
      const dist = Math.sqrt(rx * rx + ry * ry);
      
      if (dist > 0.25) {
        this.lastAim = { x: rx / dist, y: ry / dist };
        if (!activeLock) {
          shootDir = this.lastAim;
        }
      }
    } else {
      let ax = 0;
      let ay = 0;
      
      if (this.keys['ArrowUp']) ay -= 1;
      if (this.keys['ArrowDown']) ay += 1;
      if (this.keys['ArrowLeft']) ax -= 1;
      if (this.keys['ArrowRight']) ax += 1;
      
      const isAiming = (ax !== 0 || ay !== 0);
      
      if (isAiming) {
        const len = Math.sqrt(ax * ax + ay * ay);
        this.lastAim = { x: ax / len, y: ay / len };
        
        if (!activeLock) {
          shootDir = this.lastAim;
        }
      }
    }
    
    if (activeLock) {
      shootDir = this.lastAim;
    }
    
    // Fire weapon
    if (shootDir && (timestamp - this.lastShotAt >= p.fireInterval)) {
      this.fireWeapon(shootDir);
      this.lastShotAt = timestamp;
    }
    
    // Electric aura updates (pulses periodically)
    if (p.auraLevel > 0) {
      const pulseInterval = 1600 - p.auraLevel * 200; // ms between pulses
      if (timestamp - this.lastAuraPulseAt >= pulseInterval) {
        this.triggerAuraPulse();
        this.lastAuraPulseAt = timestamp;
      }
    }
  }
  
  fireWeapon(dir) {
    const p = this.player;
    
    // Speed of bullets
    const bulletSpeed = 550;
    const vx = dir.x * bulletSpeed;
    const vy = dir.y * bulletSpeed;
    
    // Spawn main bullet
    this.spawnBullet(p.x, p.y, vx, vy);
    
    // Shotgun angled bullets
    if (p.shotgunLevel >= 1) {
      const spreads = [];
      for (let k = 1; k <= p.shotgunLevel; k++) {
        spreads.push(12 * k, -12 * k); // Generate spreads dynamically (12 deg spacing)
      }
      spreads.forEach(angleDeg => {
        const angleRad = angleDeg * Math.PI / 180;
        const rx = dir.x * Math.cos(angleRad) - dir.y * Math.sin(angleRad);
        const ry = dir.x * Math.sin(angleRad) + dir.y * Math.cos(angleRad);
        this.spawnBullet(p.x, p.y, rx * bulletSpeed, ry * bulletSpeed);
      });
    }
    
    audio.play('shoot');
  }
  
  spawnBullet(x, y, vx, vy) {
    const radius = this.player.bulletRadius;
    const damage = radius / 4.0; // Damage scales proportionally to bullet size (base radius 4 is 1.0 dmg)
    this.bullets.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      radius: radius,
      damage: damage,
      pierceRemaining: this.player.bulletPierce,
      hitEnemies: new Set(), // Track which enemies this specific bullet already hit (no multi-damage same frame)
      color: COLORS.blue,
      life: 2.0 // seconds of lifetime
    });
  }
  
  triggerAuraPulse() {
    const p = this.player;
    const radius = 80 + p.auraLevel * 25;
    const damage = 0.8 + p.auraLevel * 0.4;
    
    // Visually pulse the aura
    this.particles.push({
      type: 'pulse',
      x: p.x,
      y: p.y,
      radius: radius,
      color: COLORS.purple,
      timer: 0.3, // animation duration
      maxTimer: 0.3
    });
    
    // Damage enemies inside
    this.enemies.forEach(e => {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius + e.radius) {
        e.hp -= damage;
        this.spawnBurst(e.x, e.y, COLORS.purple, 3, 30);
        
        // Spawn damage number or quick indicator
        if (e.hp <= 0 && !e.dead) {
          e.dead = true;
          this.killEnemy(e);
        } else {
          // Play a slight tick sound or visual spark
        }
      }
    });
  }
  
  updateSpawning(timestamp) {
    // Spawning interval scales down over time (gets harder)
    const baseSpawnRate = 1800; // ms
    const minSpawnRate = 350;
    const currentSpawnRate = Math.max(minSpawnRate, baseSpawnRate - Math.sqrt(this.timeElapsed) * 120);
    
    if (timestamp - this.lastSpawnAt >= currentSpawnRate) {
      this.spawnEnemy();
      this.lastSpawnAt = timestamp;
    }
  }
  
  spawnEnemy() {
    // Determine enemy kinds based on time elapsed
    const kinds = ['chaser'];
    if (this.timeElapsed > 15) kinds.push('sprinter');
    if (this.timeElapsed > 35) kinds.push('tank');
    if (this.timeElapsed > 55) kinds.push('splitter');
    if (this.timeElapsed > 80) kinds.push('shooter');
    
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    
    // Spawn location: on a random edge of the arena (inset slightly)
    let x, y;
    const margin = 20;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: // Top
        x = Math.random() * ARENA_WIDTH;
        y = margin;
        break;
      case 1: // Bottom
        x = Math.random() * ARENA_WIDTH;
        y = ARENA_HEIGHT - margin;
        break;
      case 2: // Left
        x = margin;
        y = Math.random() * ARENA_HEIGHT;
        break;
      case 3: // Right
        x = ARENA_WIDTH - margin;
        y = Math.random() * ARENA_HEIGHT;
        break;
    }
    
    let hp = 1;
    let speed = 120;
    let radius = 10;
    let color = '#ffffff';
    
    switch (kind) {
      case 'chaser':
        hp = 1.0 + Math.floor(this.timeElapsed / 60) * 0.5; // Scale HP over time
        speed = 130 + Math.random() * 20;
        radius = 11;
        color = COLORS.green;
        break;
      case 'sprinter':
        hp = 0.5;
        speed = 220 + Math.random() * 30;
        radius = 9;
        color = COLORS.purple;
        break;
      case 'tank':
        hp = 5.0 + Math.floor(this.timeElapsed / 60) * 2.0;
        speed = 70;
        radius = 20;
        color = COLORS.orange;
        break;
      case 'splitter':
        hp = 2.5;
        speed = 100;
        radius = 15;
        color = COLORS.yellow;
        break;
      case 'shooter':
        hp = 2.0;
        speed = 110;
        radius = 13;
        color = COLORS.red;
        break;
    }
    
    this.enemies.push({
      kind: kind,
      x: x,
      y: y,
      radius: radius,
      hp: hp,
      maxHP: hp,
      speed: speed,
      color: color,
      shootCooldownTimer: Math.random() * 1500, // start with random offset
      dead: false
    });
  }
  
  spawnShard(x, y, value = 1) {
    this.shards.push({
      x: x,
      y: y,
      radius: 4,
      value: value,
      color: COLORS.yellow,
      vx: 0,
      vy: 0,
      pulled: false
    });
  }
  
  spawnBurst(x, y, color, count = 8, maxDist = 50) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        type: 'dot',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: color,
        life: 0.3 + Math.random() * 0.4
      });
    }
  }
  
  updateEntities(dt, timestamp) {
    const p = this.player;
    
    // 1. Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      
      // Remove out of bounds or dead bullets
      if (b.life <= 0 || b.x < 0 || b.x > ARENA_WIDTH || b.y < 0 || b.y > ARENA_HEIGHT) {
        this.bullets.splice(i, 1);
      }
    }
    
    // 2. Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;
      
      if (eb.life <= 0 || eb.x < 0 || eb.x > ARENA_WIDTH || eb.y < 0 || eb.y > ARENA_HEIGHT) {
        this.enemyBullets.splice(i, 1);
      }
    }
    
    // 3. Enemies
    this.enemies.forEach(e => {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (e.kind === 'shooter') {
        // Move towards player but stop when in shooting range (around 220px)
        const targetDist = 200;
        if (dist > targetDist + 10) {
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
        } else if (dist < targetDist - 30) {
          // Back up slightly if too close
          e.x -= (dx / dist) * e.speed * 0.5 * dt;
          e.y -= (dy / dist) * e.speed * 0.5 * dt;
        }
        
        // Shoots bullet
        e.shootCooldownTimer += dt * 1000;
        if (e.shootCooldownTimer >= 2200) {
          // Spawn enemy bullet towards player
          const bx = e.x;
          const by = e.y;
          const bvx = (dx / dist) * 250;
          const bvy = (dy / dist) * 250;
          this.enemyBullets.push({
            x: bx,
            y: by,
            vx: bvx,
            vy: bvy,
            radius: 5,
            color: COLORS.red,
            life: 3.5
          });
          e.shootCooldownTimer = 0;
        }
      } else {
        // Normal chasers move directly to player
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      }
    });
    
    // 4. Shards Attraction (Attracted to player based on pickupRadius)
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= p.pickupRadius || s.pulled) {
        s.pulled = true;
        // Move towards player with increasing acceleration
        const pullSpeed = 400;
        s.vx = (dx / dist) * pullSpeed;
        s.vy = (dy / dist) * pullSpeed;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      
      // Consume shard
      if (dist <= p.radius + s.radius + 3) {
        this.addXP(s.value);
        audio.play('pickup');
        this.shards.splice(i, 1);
      }
    }
    
    // 5. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      if (part.type === 'dot') {
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        part.life -= dt;
        if (part.life <= 0) this.particles.splice(i, 1);
      } else if (part.type === 'pulse') {
        part.timer -= dt;
        if (part.timer <= 0) this.particles.splice(i, 1);
      }
    }
    
    // 6. Dash Trails (Burn flames)
    for (let i = this.burnTrails.length - 1; i >= 0; i--) {
      const bt = this.burnTrails[i];
      bt.timer -= dt * 1000;
      if (bt.timer <= 0) {
        this.burnTrails.splice(i, 1);
      }
    }
  }
  
  checkCollisions(timestamp) {
    const p = this.player;
    
    // 1. Bullets vs Enemies
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.dead) continue;
        
        // Skip if this specific bullet already hit this enemy
        if (b.hitEnemies.has(e)) continue;
        
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= b.radius + e.radius) {
          // Hit! Damage enemy
          e.hp -= b.damage; // Damage scales with bullet size
          b.hitEnemies.add(e);
          b.pierceRemaining--;
          
          this.spawnBurst(b.x, b.y, e.color, 4, 30);
          
          if (e.hp <= 0) {
            e.dead = true;
            this.killEnemy(e);
          }
          
          if (b.pierceRemaining <= 0) {
            this.bullets.splice(i, 1);
            break; // Bullet destroyed, stop checking other enemies
          }
        }
      }
    }
    
    // 2. Dash Burn Trails vs Enemies
    this.burnTrails.forEach(bt => {
      this.enemies.forEach(e => {
        if (e.dead) return;
        const dx = bt.x - e.x;
        const dy = bt.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= bt.radius + e.radius) {
          // Apply burn tick damage (scaled by frame dt inside logic)
          // Since this runs at 60fps, apply a small fraction of damage
          e.hp -= bt.damage * 0.04;
          if (Math.random() < 0.1) {
            this.spawnBurst(e.x, e.y, COLORS.orange, 1, 20);
          }
          
          if (e.hp <= 0) {
            e.dead = true;
            this.killEnemy(e);
          }
        }
      });
    });
    
    // 3. Enemies vs Player
    if (p.invulnTimer <= 0) {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= p.radius + e.radius) {
          this.hurtPlayer(1.0);
          break; // Player hurt, triggers invulnerability, stop checking
        }
      }
    }
    
    // 4. Enemy Bullets vs Player
    if (p.invulnTimer <= 0) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        const dx = p.x - eb.x;
        const dy = p.y - eb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= p.radius + eb.radius) {
          this.hurtPlayer(1.0);
          this.enemyBullets.splice(i, 1); // remove bullet
          break;
        }
      }
    }
  }
  
  killEnemy(e) {
    this.score += Math.ceil(e.maxHP * 10);
    this.kills++;
    audio.play('kill');
    this.screenShake = Math.max(this.screenShake, 3);
    
    // Particle burst
    this.spawnBurst(e.x, e.y, e.color, 12, 60);
    
    // Shards drop
    let xpValue = 1;
    if (e.kind === 'tank') xpValue = 4;
    else if (e.kind === 'splitter') xpValue = 2;
    else if (e.kind === 'shooter') xpValue = 2;
    else if (e.kind === 'sprinter') xpValue = 1;
    
    this.spawnShard(e.x, e.y, xpValue);
    
    // Splitter splits
    if (e.kind === 'splitter') {
      const fragmentsCount = 2;
      for (let k = 0; k < fragmentsCount; k++) {
        const angle = (Math.PI * 2 / fragmentsCount) * k + (Math.random() * 0.5);
        const fSpeed = 160;
        this.enemies.push({
          kind: 'fragment',
          x: e.x + Math.cos(angle) * 10,
          y: e.y + Math.sin(angle) * 10,
          radius: 6,
          hp: 0.5,
          maxHP: 0.5,
          speed: fSpeed,
          color: COLORS.yellow,
          shootCooldownTimer: 0,
          dead: false
        });
      }
    }
    
    // Remove from array
    this.enemies = this.enemies.filter(enemy => enemy !== e);
  }
  
  hurtPlayer(dmg) {
    const p = this.player;
    p.hp -= dmg;
    p.invulnTimer = INVULNERABILITY_DURATION;
    audio.play('hurt');
    this.screenShake = Math.max(this.screenShake, 15);
    this.triggerFlash('rgba(255, 51, 102, 0.4)', 0.4);
    
    this.spawnBurst(p.x, p.y, COLORS.red, 20, 100);
    
    if (p.hp <= 0) {
      p.hp = 0;
      this.endGame();
    }
  }
  
  addXP(amount) {
    this.xp += amount;
    this.score += amount * 5;
    
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.levelUp();
    }
  }
  
  levelUp() {
    this.level++;
    this.xpNeeded = 10 + this.level * 8;
    audio.play('levelUp');
    this.triggerFlash('rgba(155, 81, 224, 0.3)', 0.3);
    
    this.phase = 'levelUp';
    this.showLevelUpMenu();
  }
  
  showLevelUpMenu() {
    this.levelupScreen.classList.remove('hidden');
    
    // Randomly select 3 non-maxed upgrades
    const availableKeys = Object.keys(UPGRADES).filter(key => {
      const currentVal = this.player.upgrades[key];
      const maxVal = UPGRADES[key].max;
      return currentVal < maxVal;
    });
    
    // Shuffle available keys
    const shuffled = [...availableKeys].sort(() => 0.5 - Math.random());
    
    // Take up to 3 options
    this.levelUpOptions = shuffled.slice(0, 3);
    
    // If no upgrades are available (all maxed out), we can offer a fallback option (e.g. score bonus)
    // Populate UI
    for (let i = 0; i < 3; i++) {
      const upgradeKey = this.levelUpOptions[i];
      const element = document.getElementById(`upgrade-${i + 1}`);
      
      if (upgradeKey) {
        element.style.display = 'flex';
        const nameNode = element.querySelector('.upgrade-name');
        const descNode = element.querySelector('.upgrade-desc');
        
        const upgradeInfo = UPGRADES[upgradeKey];
        const currentLvl = this.player.upgrades[upgradeKey];
        
        nameNode.innerText = `${upgradeInfo.title} (LV.${currentLvl + 1})`;
        descNode.innerText = upgradeInfo.detail;
      } else {
        // Out of upgrades, hide
        element.style.display = 'none';
      }
    }
    this.updateUpgradeKeys();
  }
  
  chooseUpgrade(index) {
    if (this.phase !== 'levelUp') return;
    
    const upgradeKey = this.levelUpOptions[index];
    if (!upgradeKey) return;
    
    // Track selected upgrade order
    this.selectedUpgradeOrder.push(upgradeKey);
    analytics.trackUpgrade(
      upgradeKey,
      this.selectedUpgradeOrder.length,
      this.selectedUpgradeOrder.join(', ')
    );
    
    const p = this.player;
    p.upgrades[upgradeKey]++;
    
    // Apply Upgrade effects
    switch (upgradeKey) {
      case 'maxHP':
        p.maxHP += 1;
        p.hp = Math.min(p.maxHP, p.hp + 1.5); // Heal 1.5 HP on upgrade
        break;
      case 'movement':
        p.moveSpeed = BASE_PLAYER_SPEED * Math.pow(1.12, p.upgrades.movement);
        break;
      case 'fireRate':
        p.fireInterval = BASE_FIRE_INTERVAL * Math.pow(0.85, p.upgrades.fireRate);
        break;
      case 'bulletSize':
        p.bulletRadius = 4 * Math.pow(1.25, p.upgrades.bulletSize);
        break;
      case 'pierce':
        p.bulletPierce = 1 + p.upgrades.pierce;
        break;
      case 'dashCooldown':
        p.dashCooldown = BASE_DASH_COOLDOWN * Math.pow(0.82, p.upgrades.dashCooldown);
        break;
      case 'pickupRadius':
        p.pickupRadius = 65 * Math.pow(1.35, p.upgrades.pickupRadius);
        break;
      case 'shotgun':
        p.shotgunLevel = p.upgrades.shotgun;
        break;
      case 'aura':
        p.auraLevel = p.upgrades.aura;
        break;
      case 'burnTrail':
        p.burnTrailLevel = p.upgrades.burnTrail;
        break;
    }
    
    // Clean up menu and resume
    this.levelupScreen.classList.add('hidden');
    this.phase = 'playing';
    audio.resume();
  }
  
  endGame() {
    this.phase = 'gameOver';
    audio.play('gameOver');
    this.triggerFlash('rgba(255, 0, 0, 0.6)', 0.6);
    this.screenShake = 20;
    
    // Send final stats to analytics
    analytics.endGame(
      this.score,
      this.timeElapsed,
      this.kills,
      this.selectedUpgradeOrder.join(', '),
      'died'
    );
    
    // Check high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewHighScore = true;
      try {
        localStorage.setItem('signalRunner.highScore', this.highScore);
      } catch (e) {}
    }
    
    // Show death screen
    document.getElementById('final-score').innerText = String(this.score).padStart(6, '0');
    document.getElementById('final-kills').innerText = `${this.kills} GLITCHES DELETED`;
    document.getElementById('final-time').innerText = `${this.timeElapsed.toFixed(0)}s ACTIVE`;
    
    const recordLabel = document.getElementById('new-record-label');
    if (this.isNewHighScore) {
      recordLabel.classList.remove('hidden');
    } else {
      recordLabel.classList.add('hidden');
    }
    
    this.gameoverScreen.classList.remove('hidden');
  }
  
  // Render Engine
  render() {
    const ctx = this.ctx;
    const p = this.player;
    
    // Clear screen
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate viewport camera center
    const viewWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const viewHeight = this.canvas.height / (window.devicePixelRatio || 1);
    
    // Lerp camera to player
    this.camera.x += (p.x - viewWidth / 2 - this.camera.x) * 0.1;
    this.camera.y += (p.y - viewHeight / 2 - this.camera.y) * 0.1;
    
    // Apply camera clamp to arena borders
    this.camera.x = Math.max(0, Math.min(ARENA_WIDTH - viewWidth, this.camera.x));
    this.camera.y = Math.max(0, Math.min(ARENA_HEIGHT - viewHeight, this.camera.y));
    
    ctx.save();
    
    // Screen shake translate
    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(dx, dy);
    }
    
    // Camera scroll translate
    ctx.translate(-this.camera.x, -this.camera.y);
    
    // Draw vector background grid (sleek futuristic look)
    this.drawBackgroundGrid();
    
    // Draw boundary walls
    this.drawArenaWalls();
    
    // Draw Shards (XP pickups)
    this.drawShards();
    
    // Draw Dash Burn Trails
    this.drawBurnTrails();
    
    // Draw Bullets
    this.drawBullets();
    
    // Draw Enemies
    this.drawEnemies();
    
    // Draw Particles
    this.drawParticles();
    
    // Draw Player
    this.drawPlayer();
    
    ctx.restore();
  }
  
  drawBackgroundGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.04)';
    ctx.lineWidth = 1;
    
    const gridSize = 80;
    
    // Verticals
    for (let x = 0; x <= ARENA_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    
    // Horizontals
    for (let y = 0; y <= ARENA_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }
  }
  
  drawArenaWalls() {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 4;
    
    // Draw outer boundary lines
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.blue;
    ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);
    ctx.shadowBlur = 0; // reset
  }
  
  drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    
    // Invulnerability blinking
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer / 100) % 2 === 0) {
      return;
    }
    
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Draw Electric Aura
    if (p.auraLevel > 0) {
      const radius = 80 + p.auraLevel * 25;
      ctx.strokeStyle = 'rgba(155, 81, 224, 0.15)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.purple;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw dynamic arcs/signals inside the aura
      ctx.strokeStyle = 'rgba(155, 81, 224, 0.3)';
      const angleOffset = (Date.now() / 800) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, angleOffset, angleOffset + 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, angleOffset + Math.PI, angleOffset + Math.PI + 1.2);
      ctx.stroke();
    }
    
    // Draw player vector shape (Neon blue circle with an inner core triangle pointing in last aim direction)
    const color = COLORS.blue;
    
    // Core Triangle showing aim angle
    const angle = Math.atan2(this.lastAim.y, this.lastAim.x);
    ctx.rotate(angle);
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    
    // Outer triangle
    ctx.beginPath();
    ctx.moveTo(p.radius * 1.3, 0);
    ctx.lineTo(-p.radius * 0.9, -p.radius * 0.85);
    ctx.lineTo(-p.radius * 0.4, 0);
    ctx.lineTo(-p.radius * 0.9, p.radius * 0.85);
    ctx.closePath();
    ctx.stroke();
    
    // Inner glowing core dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  drawEnemies() {
    const ctx = this.ctx;
    
    this.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      
      const r = e.radius;
      
      switch (e.kind) {
        case 'chaser': // Green triangle pointing at player
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(r * 1.2, 0);
          ctx.lineTo(-r * 0.8, -r * 0.85);
          ctx.lineTo(-r * 0.4, 0);
          ctx.lineTo(-r * 0.8, r * 0.85);
          ctx.closePath();
          ctx.stroke();
          break;
          
        case 'sprinter': // Fast purple chevron
          const sAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          ctx.rotate(sAngle);
          ctx.beginPath();
          ctx.moveTo(r * 1.1, 0);
          ctx.lineTo(-r * 0.9, -r * 0.9);
          ctx.lineTo(-r * 0.2, 0);
          ctx.lineTo(-r * 0.9, r * 0.9);
          ctx.lineTo(r * 1.1, 0);
          ctx.stroke();
          break;
          
        case 'tank': // Slow orange square/hexagon
          ctx.rotate(Date.now() / 1500); // slow rotation
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const hexAngle = (Math.PI * 2 / 6) * i;
            const x = Math.cos(hexAngle) * r;
            const y = Math.sin(hexAngle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          
          // Draw inner structural support lines
          ctx.strokeStyle = 'rgba(255, 159, 28, 0.3)';
          ctx.beginPath();
          ctx.moveTo(0, -r); ctx.lineTo(0, r);
          ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
          ctx.stroke();
          break;
          
        case 'splitter': // Yellow diamond
          ctx.rotate(Date.now() / 1000);
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.stroke();
          
          // Draw inner square
          ctx.strokeRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8);
          break;
          
        case 'shooter': // Red octagon
          ctx.rotate(Date.now() / 1200);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const octAngle = (Math.PI * 2 / 8) * i;
            const x = Math.cos(octAngle) * r;
            const y = Math.sin(octAngle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          
          // Red core
          ctx.fillStyle = COLORS.red;
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'fragment': // Small yellow circle/crosshair
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
      
      // Draw HP Bar for damaged enemies (only show if not at full health)
      if (e.hp < e.maxHP && e.hp > 0) {
        ctx.shadowBlur = 0; // turn off glow for HP bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-r, -r - 10, r * 2, 3);
        ctx.fillStyle = e.color;
        ctx.fillRect(-r, -r - 10, (r * 2) * (e.hp / e.maxHP), 3);
      }
      
      ctx.restore();
    });
  }
  
  drawBullets() {
    const ctx = this.ctx;
    
    // Draw Player Bullets (Cyan glowing dashes)
    this.bullets.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle);
      
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      ctx.moveTo(-b.radius * 1.5, 0);
      ctx.lineTo(b.radius * 1.5, 0);
      ctx.stroke();
      
      ctx.restore();
    });
    
    // Draw Enemy Bullets (Red glowing circles)
    this.enemyBullets.forEach(eb => {
      ctx.save();
      ctx.translate(eb.x, eb.y);
      
      ctx.fillStyle = eb.color;
      ctx.shadowColor = eb.color;
      ctx.shadowBlur = 12;
      
      ctx.beginPath();
      ctx.arc(0, 0, eb.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }
  
  drawShards() {
    const ctx = this.ctx;
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.yellow;
    
    this.shards.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Date.now() / 400 + s.x); // dynamic rotation
      
      ctx.fillStyle = s.color;
      ctx.beginPath();
      
      // Draw tiny diamond shape
      ctx.moveTo(0, -s.radius);
      ctx.lineTo(s.radius * 0.7, 0);
      ctx.lineTo(0, s.radius);
      ctx.lineTo(-s.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
    ctx.shadowBlur = 0;
  }
  
  drawBurnTrails() {
    const ctx = this.ctx;
    
    this.burnTrails.forEach(bt => {
      ctx.save();
      ctx.translate(bt.x, bt.y);
      
      // Calculate opacity based on remaining timer
      const alpha = Math.min(1, bt.timer / 1000);
      ctx.strokeStyle = `rgba(255, 159, 28, ${alpha})`;
      ctx.shadowColor = COLORS.orange;
      ctx.shadowBlur = 10 * alpha;
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      // Draw cross/glitch vector flame
      const offset = bt.radius * (0.5 + Math.random() * 0.5);
      ctx.moveTo(-offset, 0);
      ctx.lineTo(offset, 0);
      ctx.moveTo(0, -offset);
      ctx.lineTo(0, offset);
      ctx.stroke();
      
      ctx.restore();
    });
    ctx.shadowBlur = 0;
  }
  
  drawParticles() {
    const ctx = this.ctx;
    
    this.particles.forEach(part => {
      if (part.type === 'dot') {
        const alpha = Math.min(1, part.life / 0.5);
        ctx.fillStyle = part.color;
        ctx.shadowColor = part.color;
        ctx.shadowBlur = 6 * alpha;
        
        ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
      } else if (part.type === 'pulse') {
        const progress = 1 - part.timer / part.maxTimer;
        const currentRadius = part.radius * progress;
        const alpha = Math.max(0, 1 - progress);
        
        ctx.strokeStyle = `rgba(155, 81, 224, ${alpha})`;
        ctx.shadowColor = COLORS.purple;
        ctx.shadowBlur = 15 * alpha;
        ctx.lineWidth = 3 * (1 - progress);
        
        ctx.beginPath();
        ctx.arc(part.x, part.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.shadowBlur = 0;
  }
}

// Initialize game on window load
window.addEventListener('load', () => {
  window.game = new Game();
  
  // Register Service Worker for PWA compatibility
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.warn('Service Worker registration failed:', err));
  }
});
