// Google Analytics Tracker for Signal Runner Web
// Tracking measurement ID: G-RSVR6Y389R

let sessionActive = false;
let sessionEnded = false;
let currentScore = 0;
let currentDuration = 0;
let currentKills = 0;
let currentUpgradesList = '';

export const analytics = {
  startGame() {
    sessionActive = true;
    sessionEnded = false;
    currentScore = 0;
    currentDuration = 0;
    currentKills = 0;
    currentUpgradesList = '';
    
    this.sendEvent('game_start', {
      time_initiated: new Date().toISOString()
    });
  },

  updateSessionStats(score, duration, kills, upgradesList) {
    currentScore = score;
    currentDuration = duration;
    currentKills = kills;
    currentUpgradesList = upgradesList;
  },

  trackUpgrade(upgradeName, upgradeIndex, upgradeSequence) {
    this.sendEvent('game_upgrade', {
      upgrade_name: upgradeName,
      upgrade_index: upgradeIndex,
      upgrade_sequence: upgradeSequence
    });
  },

  endGame(score, duration, kills, upgradesList, quitReason) {
    if (sessionEnded) return; // Prevent double-reporting
    sessionEnded = true;
    sessionActive = false;

    const params = {
      score: score,
      duration_seconds: Math.round(duration),
      kills: kills,
      upgrades_sequence: upgradesList,
      quit_reason: quitReason
    };

    // Use beacon transport if the page is unloading
    if (quitReason === 'quit_before_death') {
      params.transport = 'beacon';
    }

    this.sendEvent('game_session_end', params);
  },

  sendEvent(eventName, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
      console.log(`[Analytics] Event: ${eventName}`, params);
    } else {
      console.log(`[Analytics Mock] Event: ${eventName}`, params);
    }
  }
};

// Monitor page unload/exit for mid-game quit tracking
window.addEventListener('pagehide', () => {
  if (sessionActive && !sessionEnded) {
    // Player closed or navigated away mid-game before dying
    analytics.endGame(
      currentScore,
      currentDuration,
      currentKills,
      currentUpgradesList,
      'quit_before_death'
    );
  }
});
