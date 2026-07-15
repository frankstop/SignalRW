// Thin adapter over the shared embed analytics script (loaded in index.html
// from frankiejvaldez.com). Shared event contract:
//   game_start { game_name }
//   game_end   { game_name, outcome, score, duration_seconds }
// Quit-before-death tracking is handled by the shared script's pagehide
// beacon, which reads the live score through the startRun callback.

let currentScore = 0;

export const analytics = {
  startGame() {
    currentScore = 0;
    if (window.embedAnalytics) {
      window.embedAnalytics.startRun('SignalRW', () => currentScore);
    }
  },

  updateSessionStats(score) {
    currentScore = score;
  },

  endGame(score) {
    if (window.embedAnalytics) {
      window.embedAnalytics.endRun('lose', score);
    }
  }
};
