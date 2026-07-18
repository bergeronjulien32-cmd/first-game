(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 50;

  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const comboEl = document.getElementById("combo");
  const stageEl = document.getElementById("level");
  const startScreen = document.getElementById("start-screen");
  const startBestEl = document.getElementById("start-best");
  const achievementsEl = document.getElementById("achievements");
  const dailyLabelEl = document.getElementById("daily-label");
  const dailyProgressFillEl = document.getElementById("daily-progress-fill");
  const dailyStatusEl = document.getElementById("daily-status");
  const dailyStreakEl = document.getElementById("daily-streak");
  const pauseScreen = document.getElementById("pause-screen");
  const gameOverScreen = document.getElementById("game-over-screen");
  const gameoverTitleEl = document.getElementById("gameover-title");
  const finalScoreValueEl = document.getElementById("final-score-value");
  const scoreDeltaEl = document.getElementById("score-delta");
  const statCoinsEl = document.getElementById("stat-coins");
  const statComboEl = document.getElementById("stat-combo");
  const statStageEl = document.getElementById("stat-stage");
  const statNearMissEl = document.getElementById("stat-nearmiss");
  const dailyResultEl = document.getElementById("daily-result");
  const motivationLineEl = document.getElementById("motivation-line");
  const unlockedListEl = document.getElementById("unlocked-list");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const muteBtn = document.getElementById("mute-btn");
  const canvasFrame = document.getElementById("canvas-frame");
  const flashEl = document.getElementById("flash");
  const touchControls = document.getElementById("touch-controls");
  const touchJumpBtn = document.getElementById("touch-jump");
  const touchDuckBtn = document.getElementById("touch-duck");

  const HIGH_SCORE_KEY = "dashRunnerHighScore";
  const MUTE_KEY = "dashRunnerMuted";
  const LIFETIME_KEY = "dashRunnerLifetime";
  const DAILY_COMPLETED_KEY = "dashRunnerDailyCompleted";
  const DAILY_BEST_KEY = "dashRunnerDailyBest";

  const STAND_HEIGHT = 50;
  const DUCK_HEIGHT = 30;
  const PLAYER_X = 90;
  const PLAYER_WIDTH = 40;

  const GRAVITY_RISE = 2200; // lighter gravity while ascending = more control / hang time
  const GRAVITY_FALL = 3400; // heavier gravity while falling = snappy, responsive landings
  const JUMP_VELOCITY = -880;
  const JUMP_CUT_MULTIPLIER = 0.45; // releasing jump early shortens the arc
  const JUMP_BUFFER_TIME = 0.12; // pressing jump just before landing still registers

  const BASE_SPEED = 320;
  const MAX_SPEED = 860;
  const SPEED_RAMP = 5.5; // px/sec^2 added to speed per second survived

  const COIN_SCORE = 25;
  const COIN_RADIUS = 10;
  const NEAR_MISS_MARGIN = 18; // px gap under/over an obstacle that still counts as "close"
  const NEAR_MISS_SCORE = 15;
  const HITSTOP_DURATION = 0.08;

  const isTouchDevice = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouchDevice) touchControls.classList.add("enabled");
  const isNarrowScreen = window.innerWidth < 480;
  const MAX_PARTICLES = isNarrowScreen ? 55 : 110;
  const STAR_COUNT = isNarrowScreen ? 22 : 40;

  // ---- staged difficulty: variety, not just raw speed ----
  const STAGES = [
    { time: 0, name: "Warm-up", flying: false, patterns: false, coins: false, spawnRange: [1.3, 1.85], sky: ["#181c39", "#0d0f1c"] },
    { time: 8, name: "Fly Watch", flying: true, patterns: false, coins: true, spawnRange: [1.1, 1.6], sky: ["#1b1f45", "#0d0f1c"] },
    { time: 20, name: "Combo Time", flying: true, patterns: true, coins: true, spawnRange: [0.9, 1.35], sky: ["#231a4a", "#100a1f"] },
    { time: 40, name: "Overdrive", flying: true, patterns: true, coins: true, spawnRange: [0.7, 1.1], sky: ["#2a1743", "#160a20"], breather: true },
  ];
  const STAGE_INTRO_HINT = {
    1: "Duck under flying obstacles!",
    2: "Watch for obstacle combos!",
    3: "Overdrive — stay sharp!",
  };

  function getStage() {
    let s = STAGES[0];
    for (const st of STAGES) if (elapsed >= st.time) s = st;
    return s;
  }

  // ---- achievements (persisted locally, no external services) ----
  // "progress" achievements track the best-ever single-run value for a metric against a target,
  // so badges can show live progress (e.g. "9/15") instead of just locked/unlocked.
  const ACHIEVEMENTS = [
    { id: "first-run", name: "First Run", icon: "🏁", type: "flag" },
    { id: "score-500", name: "Score 500", icon: "⭐", type: "progress", metric: "bestScore", target: 500 },
    { id: "score-2000", name: "Score 2000", icon: "🌟", type: "progress", metric: "bestScore", target: 2000 },
    { id: "coin-collector", name: "15 Coins", icon: "🪙", type: "progress", metric: "bestCoinsInRun", target: 15 },
    { id: "combo-master", name: "Combo x4", icon: "🔥", type: "progress", metric: "bestComboInRun", target: 4 },
    { id: "marathoner", name: "Survive 60s", icon: "⏱️", type: "progress", metric: "bestSurvivalInRun", target: 60 },
    { id: "new-record", name: "New Best", icon: "🏆", type: "flag" },
  ];

  const Achievements = (() => {
    const KEY = "dashRunnerAchievements";
    let unlocked;
    try {
      unlocked = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      unlocked = new Set();
    }
    return {
      isUnlocked(id) { return unlocked.has(id); },
      // metrics: { bestScore, bestCoinsInRun, bestComboInRun, bestSurvivalInRun, isNewBest }
      evaluate(metrics) {
        const newly = [];
        for (const a of ACHIEVEMENTS) {
          if (unlocked.has(a.id)) continue;
          const done = a.type === "flag" ? (a.id === "new-record" ? metrics.isNewBest : true) : metrics[a.metric] >= a.target;
          if (done) {
            unlocked.add(a.id);
            newly.push(a);
          }
        }
        if (newly.length) localStorage.setItem(KEY, JSON.stringify([...unlocked]));
        return newly;
      },
    };
  })();

  function renderAchievementBadges() {
    const metrics = getLifetimeMetrics();
    achievementsEl.innerHTML = "";
    for (const a of ACHIEVEMENTS) {
      const unlocked = Achievements.isUnlocked(a.id);
      const badge = document.createElement("span");
      badge.className = "badge" + (unlocked ? " unlocked" : "");
      badge.title = a.name;
      let progressHtml = "";
      if (!unlocked && a.type === "progress") {
        const current = Math.min(a.target, Math.floor(metrics[a.metric] || 0));
        progressHtml = `<span class="badge-progress">${current}/${a.target}</span>`;
      }
      badge.innerHTML = `<span class="badge-icon">${unlocked ? a.icon : "🔒"}</span>${a.name}${progressHtml}`;
      achievementsEl.appendChild(badge);
    }
  }

  // ---- lifetime stats (best-ever single-run values, drive achievement progress) ----
  function loadLifetimeStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(LIFETIME_KEY) || "{}");
      return {
        bestCoinsInRun: raw.bestCoinsInRun || 0,
        bestComboInRun: raw.bestComboInRun || 0,
        bestSurvivalInRun: raw.bestSurvivalInRun || 0,
      };
    } catch {
      return { bestCoinsInRun: 0, bestComboInRun: 0, bestSurvivalInRun: 0 };
    }
  }

  function getLifetimeMetrics() {
    const lifetime = loadLifetimeStats();
    return {
      bestScore: getHighScore(),
      bestCoinsInRun: lifetime.bestCoinsInRun,
      bestComboInRun: lifetime.bestComboInRun,
      bestSurvivalInRun: lifetime.bestSurvivalInRun,
    };
  }

  function updateLifetimeStats(runStats) {
    const lifetime = loadLifetimeStats();
    lifetime.bestCoinsInRun = Math.max(lifetime.bestCoinsInRun, runStats.coins);
    lifetime.bestComboInRun = Math.max(lifetime.bestComboInRun, runStats.maxCombo);
    lifetime.bestSurvivalInRun = Math.max(lifetime.bestSurvivalInRun, runStats.time);
    localStorage.setItem(LIFETIME_KEY, JSON.stringify(lifetime));
    return lifetime;
  }

  // ---- daily challenge (deterministic from the date, no backend) ----
  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dateStringOffset(dateStr, offsetDays) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offsetDays);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DAILY_TEMPLATES = [
    { metric: "score", target: (r) => Math.round((600 + r() * 900) / 50) * 50, label: (t) => `Score ${t}+ in one run` },
    { metric: "coins", target: (r) => 8 + Math.floor(r() * 10), label: (t) => `Collect ${t}+ coins in one run` },
    { metric: "maxCombo", target: (r) => 3 + Math.floor(r() * 2), label: (t) => `Reach a ×${t} combo` },
    { metric: "stage", target: (r) => 3 + Math.floor(r() * 2), label: (t) => `Reach Stage ${t}` },
    { metric: "nearMisses", target: (r) => 3 + Math.floor(r() * 5), label: (t) => `Pull off ${t}+ near-misses in one run` },
    { metric: "time", target: (r) => Math.round((30 + r() * 40) / 5) * 5, label: (t) => `Survive ${t}s in one run` },
  ];

  let _dailyChallengeCache = null;
  function getDailyChallenge() {
    if (_dailyChallengeCache) return _dailyChallengeCache;
    const dateStr = todayString();
    const rand = mulberry32(hashString(dateStr));
    const template = DAILY_TEMPLATES[Math.floor(rand() * DAILY_TEMPLATES.length)];
    const target = template.target(rand);
    _dailyChallengeCache = { dateStr, metric: template.metric, target, label: template.label(target) };
    return _dailyChallengeCache;
  }

  function loadDailyCompleted() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_COMPLETED_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveDailyCompleted(map) {
    localStorage.setItem(DAILY_COMPLETED_KEY, JSON.stringify(map));
  }

  function computeStreak(completedMap, todayStr) {
    let streak = 0;
    let cursor = completedMap[todayStr] ? todayStr : dateStringOffset(todayStr, -1);
    while (completedMap[cursor]) {
      streak++;
      cursor = dateStringOffset(cursor, -1);
    }
    return streak;
  }

  function getDailyBestToday() {
    try {
      const raw = JSON.parse(localStorage.getItem(DAILY_BEST_KEY) || "{}");
      return raw.dateStr === todayString() ? raw.value : 0;
    } catch {
      return 0;
    }
  }

  function updateDailyBestToday(value) {
    const current = getDailyBestToday();
    const next = Math.max(current, value);
    localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ dateStr: todayString(), value: next }));
    return next;
  }

  function renderDailyCard() {
    const challenge = getDailyChallenge();
    const completedMap = loadDailyCompleted();
    const doneToday = !!completedMap[challenge.dateStr];
    const bestToday = getDailyBestToday();
    const streak = computeStreak(completedMap, challenge.dateStr);

    dailyLabelEl.textContent = challenge.label;
    const pct = Math.min(100, Math.round((bestToday / challenge.target) * 100));
    dailyProgressFillEl.style.width = `${doneToday ? 100 : pct}%`;
    dailyProgressFillEl.classList.toggle("complete", doneToday);
    dailyStatusEl.textContent = doneToday
      ? "✅ Completed today — come back tomorrow for a new one!"
      : `Best today: ${Math.floor(bestToday)}/${challenge.target}`;
    dailyStreakEl.classList.toggle("hidden", streak <= 0);
    dailyStreakEl.textContent = `🔥 ${streak}`;
  }

  // ---- sound (Web Audio API, no external files) ----
  const Sound = (() => {
    let ctx = null;
    let muted = localStorage.getItem(MUTE_KEY) === "1";

    function getCtx() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone({ freq, duration = 0.12, type = "sine", gain = 0.2, glideTo = null, delay = 0 }) {
      if (muted) return;
      const audioCtx = getCtx();
      if (!audioCtx) return;
      const t0 = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + duration);
      }
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    return {
      unlock() { getCtx(); },
      isMuted() { return muted; },
      toggleMute() {
        muted = !muted;
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
        return muted;
      },
      jump() { tone({ freq: 380, glideTo: 640, duration: 0.12, type: "square", gain: 0.15 }); },
      coin(multiplier = 1) {
        const pitch = 1 + (multiplier - 1) * 0.15;
        tone({ freq: 880 * pitch, duration: 0.08, type: "sine", gain: 0.18 });
        tone({ freq: 1320 * pitch, duration: 0.12, type: "sine", gain: 0.16, delay: 0.06 });
      },
      comboBreak() { tone({ freq: 220, glideTo: 140, duration: 0.18, type: "sine", gain: 0.14 }); },
      nearMiss() { tone({ freq: 1100, duration: 0.06, type: "triangle", gain: 0.12 }); },
      stageUp() { tone({ freq: 520, glideTo: 1040, duration: 0.25, type: "triangle", gain: 0.15 }); },
      newBest() {
        tone({ freq: 660, duration: 0.1, type: "sine", gain: 0.18 });
        tone({ freq: 880, duration: 0.1, type: "sine", gain: 0.18, delay: 0.1 });
        tone({ freq: 1100, duration: 0.18, type: "sine", gain: 0.2, delay: 0.2 });
      },
      achievement() {
        tone({ freq: 740, duration: 0.09, type: "square", gain: 0.12 });
        tone({ freq: 988, duration: 0.14, type: "square", gain: 0.12, delay: 0.09 });
      },
      dailyComplete() {
        tone({ freq: 523, duration: 0.1, type: "triangle", gain: 0.16 });
        tone({ freq: 659, duration: 0.1, type: "triangle", gain: 0.16, delay: 0.1 });
        tone({ freq: 784, duration: 0.2, type: "triangle", gain: 0.18, delay: 0.2 });
      },
      gameOver() { tone({ freq: 300, glideTo: 80, duration: 0.5, type: "sawtooth", gain: 0.2 }); },
    };
  })();

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  let state = "ready"; // ready | playing | paused | hitstop | over

  let player, obstacles, coins, particles, floatingTexts;
  let speed, elapsed, score, coinsCollected, nearMissCount;
  let combo, comboMultiplier, maxComboMultiplier;
  let spawnTimer, nextSpawnIn, coinTimer, nextCoinIn, breatherTimer, nextBreatherThreshold;
  let groundOffset, farOffset, midOffset, stars, lastTime;
  let stageIndex, hitstopTimer, bestAtRunStart, bestBeatCelebrated;

  function resetGame() {
    player = {
      x: PLAYER_X,
      y: GROUND_Y - STAND_HEIGHT,
      width: PLAYER_WIDTH,
      height: STAND_HEIGHT,
      vy: 0,
      onGround: true,
      ducking: false,
      jumpHeld: false,
      jumpBufferTimer: 0,
      squash: 0, // 0..1, decays after landing for a squash/stretch bounce
      tilt: 0,
    };
    obstacles = [];
    coins = [];
    particles = [];
    floatingTexts = [];
    speed = BASE_SPEED;
    elapsed = 0;
    score = 0;
    coinsCollected = 0;
    nearMissCount = 0;
    combo = 0;
    comboMultiplier = 1;
    maxComboMultiplier = 1;
    spawnTimer = 0;
    nextSpawnIn = randRange(1.3, 1.85);
    coinTimer = 0;
    nextCoinIn = randRange(1.4, 2.4);
    breatherTimer = 0;
    nextBreatherThreshold = randRange(8, 13);
    groundOffset = 0;
    farOffset = 0;
    midOffset = 0;
    stageIndex = 0;
    hitstopTimer = 0;
    bestAtRunStart = getHighScore();
    bestBeatCelebrated = false;
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 40),
      r: Math.random() * 1.6 + 0.4,
      twinkle: Math.random() * Math.PI * 2,
    }));
    updateHud();
  }

  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function getHighScore() {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  }

  function setHighScore(v) {
    localStorage.setItem(HIGH_SCORE_KEY, String(v));
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(score);
    highScoreEl.textContent = getHighScore();
    comboEl.textContent = `×${comboMultiplier}`;
    comboEl.classList.toggle("combo-hot", comboMultiplier >= 3);
    stageEl.textContent = stageIndex + 1;
  }

  function pulseHud(el, extraClass) {
    el.classList.remove("pulse");
    if (extraClass) el.classList.remove(extraClass);
    void el.offsetWidth; // restart animation
    el.classList.add("pulse");
    if (extraClass) el.classList.add(extraClass);
  }

  function currentSpeed() {
    return Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
  }

  function updateTouchControlsVisibility() {
    touchControls.style.visibility = state === "playing" ? "visible" : "hidden";
  }

  function flashScreen(color) {
    flashEl.classList.remove("active", "gold");
    void flashEl.offsetWidth;
    if (color === "gold") flashEl.classList.add("gold");
    flashEl.classList.add("active");
  }

  function animateCountUp(el, target, duration = 700) {
    const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    el.textContent = 0;
    requestAnimationFrame(step);
  }

  // ---- particles ----
  function spawnParticles(x, y, count, opts = {}) {
    const life = opts.life ?? 0.5;
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const angle = opts.angleRange
        ? randRange(opts.angleRange[0], opts.angleRange[1])
        : Math.random() * Math.PI * 2;
      const spd = randRange(opts.speedMin ?? 40, opts.speedMax ?? 160);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        size: randRange(opts.sizeMin ?? 2, opts.sizeMax ?? 4),
        color: opts.color || "#ffffff",
        gravity: opts.gravity ?? 0,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function addFloatingText(x, y, text, color, big = false) {
    floatingTexts.push({ x, y, text, color, big, life: big ? 1.1 : 0.8, maxLife: big ? 1.1 : 0.8, vy: -40 });
  }

  // ---- obstacle spawning ----
  function makeGround(x) {
    const height = randRange(34, 64);
    const width = randRange(22, 38);
    obstacles.push({
      type: "ground",
      x,
      y: GROUND_Y - height,
      width,
      height,
      wobble: Math.random() * Math.PI * 2,
      resolved: false,
      nearMiss: false,
    });
  }

  function makeFlying(x) {
    const height = 26;
    const width = 42;
    const baseY = GROUND_Y - STAND_HEIGHT - randRange(18, 34);
    obstacles.push({
      type: "flying",
      x,
      y: baseY,
      baseY,
      width,
      height,
      wingPhase: Math.random() * Math.PI * 2,
      resolved: false,
      nearMiss: false,
    });
  }

  function spawnObstacle(stage) {
    const roll = Math.random();
    if (!stage.flying || roll < 0.68) makeGround(W + 10);
    else makeFlying(W + 10);
  }

  function spawnPattern(stage) {
    if (!stage.flying) {
      makeGround(W + 10);
      makeGround(W + 10 + 150);
      return;
    }
    const roll = Math.random();
    if (roll < 0.34) {
      makeGround(W + 10);
      makeGround(W + 10 + 150);
    } else if (roll < 0.67) {
      makeGround(W + 10);
      makeFlying(W + 10 + 130);
    } else {
      makeFlying(W + 10);
      makeGround(W + 10 + 140);
    }
  }

  function spawnCoin() {
    const highLane = Math.random() < 0.5;
    const y = highLane
      ? GROUND_Y - STAND_HEIGHT - randRange(45, 95) // needs a jump to reach
      : GROUND_Y - randRange(16, 26); // grabbed while running
    coins.push({ x: W + 10, y, r: COIN_RADIUS, phase: Math.random() * Math.PI * 2, missed: false });
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function circleRectOverlap(cx, cy, r, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  function verticalGap(playerBox, obstacleBox) {
    if (playerBox.y + playerBox.height <= obstacleBox.y) {
      return obstacleBox.y - (playerBox.y + playerBox.height);
    }
    if (playerBox.y >= obstacleBox.y + obstacleBox.height) {
      return playerBox.y - (obstacleBox.y + obstacleBox.height);
    }
    return 0;
  }

  // ---- input actions ----
  function doJump() {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.jumpHeld = true;
    Sound.jump();
    vibrate(10);
    spawnParticles(player.x + player.width / 2, GROUND_Y, 6, {
      angleRange: [Math.PI * 1.15, Math.PI * 1.85],
      speedMin: 60,
      speedMax: 140,
      life: 0.3,
      color: "rgba(255,255,255,0.55)",
      gravity: 500,
      sizeMin: 2,
      sizeMax: 3,
    });
  }

  function requestJump() {
    if (state !== "playing") return;
    if (player.onGround && !player.ducking) {
      doJump();
    } else if (!player.onGround) {
      player.jumpBufferTimer = JUMP_BUFFER_TIME;
    }
  }

  function cutJump() {
    if (!player.onGround && player.vy < -150) {
      player.vy *= JUMP_CUT_MULTIPLIER;
    }
    player.jumpHeld = false;
  }

  function setDuck(active) {
    if (state !== "playing") return;
    player.ducking = active && player.onGround;
    player.height = player.ducking ? DUCK_HEIGHT : STAND_HEIGHT;
    player.y = GROUND_Y - player.height;
  }

  function breakCombo() {
    if (combo === 0) return;
    combo = 0;
    comboMultiplier = 1;
    Sound.comboBreak();
    pulseHud(comboEl, "combo-break");
  }

  function update(dt) {
    elapsed += dt;
    speed = currentSpeed();
    score += dt * (speed / 8);

    // stage transitions bring variety, not just more speed
    const stage = getStage();
    const newStageIndex = STAGES.indexOf(stage);
    if (newStageIndex !== stageIndex) {
      stageIndex = newStageIndex;
      Sound.stageUp();
      pulseHud(stageEl);
      const hint = STAGE_INTRO_HINT[stageIndex];
      addFloatingText(W / 2, GROUND_Y - 150, stage.name, "#5eead4", true);
      if (hint) addFloatingText(W / 2, GROUND_Y - 120, hint, "#9aa3c0");
    }

    // live celebration the moment you beat your previous best
    if (!bestBeatCelebrated && bestAtRunStart > 0 && score > bestAtRunStart) {
      bestBeatCelebrated = true;
      Sound.newBest();
      vibrate([15, 40, 15]);
      addFloatingText(W / 2, 70, "NEW BEST!", "#facc15", true);
      spawnParticles(W / 2, 70, 18, {
        color: "#facc15",
        life: 0.8,
        speedMin: 60,
        speedMax: 220,
        gravity: 250,
        sizeMin: 2,
        sizeMax: 4,
      });
    }

    updateHud();

    groundOffset = (groundOffset + speed * dt) % 40;
    farOffset += speed * 0.12 * dt;
    midOffset += speed * 0.3 * dt;

    // physics: asymmetric gravity (light on the way up, heavy on the way down)
    const wasOnGround = player.onGround;
    if (!player.onGround) {
      const rising = player.vy < 0 && player.jumpHeld;
      const g = rising ? GRAVITY_RISE : GRAVITY_FALL;
      player.vy += g * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }
    if (player.jumpBufferTimer > 0) player.jumpBufferTimer -= dt;
    if (!wasOnGround && player.onGround) {
      player.squash = 1; // landing squash/stretch
      spawnParticles(player.x + player.width / 2, GROUND_Y, 8, {
        angleRange: [Math.PI * 1.1, Math.PI * 1.9],
        speedMin: 50,
        speedMax: 150,
        life: 0.35,
        color: "rgba(255,255,255,0.45)",
        gravity: 450,
        sizeMin: 2,
        sizeMax: 3,
      });
      if (player.jumpBufferTimer > 0 && !player.ducking) {
        player.jumpBufferTimer = 0;
        doJump();
      }
    }
    player.squash = Math.max(0, player.squash - dt * 5);
    player.tilt = player.onGround ? 0 : Math.max(-0.35, Math.min(0.35, player.vy / 1800));

    // spawn obstacles
    spawnTimer += dt;
    if (stage.breather) breatherTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      const usePattern = stage.patterns && Math.random() < 0.3;
      if (usePattern) spawnPattern(stage);
      else spawnObstacle(stage);

      if (stage.breather && breatherTimer > nextBreatherThreshold) {
        nextSpawnIn = randRange(2.4, 3.0);
        breatherTimer = 0;
        nextBreatherThreshold = randRange(8, 13);
      } else {
        nextSpawnIn = randRange(stage.spawnRange[0], stage.spawnRange[1]);
      }
    }

    // spawn coins
    if (stage.coins) {
      coinTimer += dt;
      if (coinTimer >= nextCoinIn) {
        coinTimer = 0;
        nextCoinIn = randRange(1.3, 2.2);
        spawnCoin();
      }
    }

    // move + collide + cull obstacles
    const playerBox = {
      x: player.x + 6,
      y: player.y + 4,
      width: player.width - 12,
      height: player.height - 6,
    };

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      if (o.type === "flying") {
        o.wingPhase += dt * 9;
        o.y = o.baseY + Math.sin(o.wingPhase) * 4;
      } else {
        o.wobble += dt * 3;
      }

      const obstacleBox = {
        x: o.x + 3,
        y: o.y + 3,
        width: o.width - 6,
        height: o.height - 6,
      };

      if (!o.resolved) {
        const horizontalOverlap = playerBox.x < obstacleBox.x + obstacleBox.width && playerBox.x + playerBox.width > obstacleBox.x;
        if (horizontalOverlap) {
          const gap = verticalGap(playerBox, obstacleBox);
          if (gap < NEAR_MISS_MARGIN) o.nearMiss = true;
        }
        if (rectsOverlap(playerBox, obstacleBox)) {
          triggerCollision(o);
          return;
        }
        if (o.x + o.width < player.x) {
          o.resolved = true;
          if (o.nearMiss) {
            score += NEAR_MISS_SCORE * comboMultiplier;
            nearMissCount += 1;
            Sound.nearMiss();
            addFloatingText(player.x + player.width + 6, player.y, "Close!", "#38bdf8");
            spawnParticles(o.x + o.width / 2, o.y + o.height / 2, 6, {
              color: "#38bdf8",
              life: 0.35,
              speedMin: 40,
              speedMax: 120,
              sizeMin: 2,
              sizeMax: 3,
            });
          }
        }
      }

      if (o.x + o.width < -10) obstacles.splice(i, 1);
    }

    // move + collide + cull coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= speed * dt;
      c.phase += dt * 6;

      if (circleRectOverlap(c.x, c.y, c.r, playerBox)) {
        coins.splice(i, 1);
        combo += 1;
        comboMultiplier = Math.min(5, 1 + Math.floor(combo / 5));
        maxComboMultiplier = Math.max(maxComboMultiplier, comboMultiplier);
        const gained = COIN_SCORE * comboMultiplier;
        score += gained;
        coinsCollected += 1;
        Sound.coin(comboMultiplier);
        vibrate(8);
        addFloatingText(c.x, c.y - 10, `+${gained}`, "#facc15");
        spawnParticles(c.x, c.y, 10, {
          color: "#facc15",
          life: 0.4,
          speedMin: 60,
          speedMax: 180,
          gravity: 200,
          sizeMin: 2,
          sizeMax: 4,
        });
        continue;
      }

      if (!c.missed && c.x + c.r < player.x - 10) {
        c.missed = true;
        breakCombo();
      }
      if (c.x + c.r < -10) coins.splice(i, 1);
    }

    updateParticles(dt);

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function triggerCollision(obstacle) {
    player.vy = 0;
    state = "hitstop";
    hitstopTimer = HITSTOP_DURATION;
    const cx = obstacle.x + obstacle.width / 2;
    const cy = obstacle.y + obstacle.height / 2;
    spawnParticles(cx, cy, 22, {
      color: "#f87171",
      life: 0.55,
      speedMin: 80,
      speedMax: 240,
      gravity: 450,
      sizeMin: 2,
      sizeMax: 5,
    });
  }

  function drawHillLayer(offset, amplitude, baseY, color, freq) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      const y = baseY - Math.sin((x + offset) * freq) * amplitude - Math.sin((x + offset) * freq * 2.3) * amplitude * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);

    const stage = STAGES[stageIndex];
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, stage.sky[0]);
    skyGrad.addColorStop(1, stage.sky[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    for (const s of stars) {
      s.twinkle += 0.02;
      const alpha = 0.35 + Math.abs(Math.sin(s.twinkle)) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawHillLayer(farOffset, 14, GROUND_Y - 30, "rgba(94, 234, 212, 0.06)", 0.012);
    drawHillLayer(midOffset, 20, GROUND_Y - 10, "rgba(94, 234, 212, 0.1)", 0.02);

    // ground line
    ctx.strokeStyle = "rgba(94, 234, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 2);
    ctx.lineTo(W, GROUND_Y + 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let x = -groundOffset; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 10);
      ctx.lineTo(x + 18, GROUND_Y + 10);
      ctx.stroke();
    }
  }

  function drawShadow(cx, groundYPos, width) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, groundYPos + 4, width, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const { x, y, width, height } = player;
    const r = 8;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const airHeight = Math.max(0, GROUND_Y - (y + height));
    const shadowScale = Math.max(0.4, 1 - airHeight / 160);
    drawShadow(cx, GROUND_Y, (width / 2) * shadowScale);

    const stretch = player.onGround ? 1 : 1.06;
    const squashY = 1 - player.squash * 0.28;
    const squashX = 1 + player.squash * 0.22;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.tilt);
    ctx.scale(squashX, stretch * squashY);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = comboMultiplier >= 3 ? "#facc15" : player.ducking ? "#f472b6" : "#5eead4";
    roundRect(ctx, x, y, width, height, r);
    ctx.fill();

    ctx.fillStyle = "#0d0f1c";
    const eyeX = x + width - 12;
    const eyeY = y + (player.ducking ? 10 : 14);
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0d0f1c";
    ctx.lineWidth = 3;
    const legY = y + height;
    if (player.onGround) {
      const cycle = (elapsed * (5 + speed / 60)) % 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, legY);
      ctx.lineTo(x + 8 + (cycle < 1 ? 4 : -4), legY + 8);
      ctx.moveTo(x + width - 10, legY);
      ctx.lineTo(x + width - 10 + (cycle < 1 ? -4 : 4), legY + 8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 8, legY - 4);
      ctx.lineTo(x + 12, legY + 4);
      ctx.moveTo(x + width - 10, legY - 4);
      ctx.lineTo(x + width - 14, legY + 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const flash = o.nearMiss && !o.resolved;
      if (o.type === "ground") {
        const wobble = Math.sin(o.wobble) * 0.04;
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        drawShadow(cx, GROUND_Y, o.width / 2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wobble);
        ctx.translate(-cx, -cy);
        const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
        grad.addColorStop(0, flash ? "#fde68a" : "#fb923c");
        grad.addColorStop(1, "#ea580c");
        ctx.fillStyle = grad;
        roundRect(ctx, o.x, o.y, o.width, o.height, 6);
        ctx.fill();
        ctx.restore();
      } else {
        const flap = Math.sin(o.wingPhase) * 8;
        ctx.save();
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(flap * 0.015);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = flash ? "#fecaca" : "#f87171";
        roundRect(ctx, o.x, o.y, o.width, o.height, 8);
        ctx.fill();
        ctx.strokeStyle = "#fecaca";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 14, cy - flap);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 14, cy - flap);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawCoins() {
    for (const c of coins) {
      const bob = Math.sin(c.phase) * 3;
      const cy = c.y + bob;
      const grad = ctx.createRadialGradient(c.x, cy, 1, c.x, cy, c.r);
      grad.addColorStop(0, "#fef9c3");
      grad.addColorStop(1, "#facc15");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, cy, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(180, 130, 10, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawFloatingTexts() {
    ctx.textAlign = "center";
    for (const f of floatingTexts) {
      ctx.font = `bold ${f.big ? 26 : 18}px system-ui, sans-serif`;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.maxLife));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }

  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function render() {
    drawBackground();
    drawCoins();
    drawObstacles();
    drawPlayer();
    drawParticles();
    drawFloatingTexts();
  }

  function loop(timestamp) {
    if (state !== "playing" && state !== "hitstop") return;
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 0.05); // avoid huge jumps on tab switch
    lastTime = timestamp;

    if (state === "hitstop") {
      hitstopTimer -= dt;
      updateParticles(dt);
      render();
      if (hitstopTimer <= 0) {
        finalizeGameOver();
      } else {
        requestAnimationFrame(loop);
      }
      return;
    }

    update(dt);
    if (state !== "playing") {
      // update() may have moved us into hitstop; keep the loop alive
      if (state === "hitstop") requestAnimationFrame(loop);
      return;
    }
    render();
    requestAnimationFrame(loop);
  }

  function startGame() {
    Sound.unlock();
    resetGame();
    state = "playing";
    lastTime = null;
    startScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    gameOverScreen.classList.remove("celebrate");
    flashEl.classList.remove("active", "gold");
    canvasFrame.classList.remove("shake");
    updateTouchControlsVisibility();
    requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    pauseScreen.classList.remove("hidden");
    updateTouchControlsVisibility();
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    pauseScreen.classList.add("hidden");
    lastTime = null;
    updateTouchControlsVisibility();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  }

  function finalizeGameOver() {
    state = "over";
    const finalScore = Math.floor(score);
    const best = getHighScore(); // pre-run best, captured before any overwrite
    const isNewBest = finalScore > best;
    if (isNewBest) setHighScore(finalScore);

    const finalStats = {
      score: finalScore,
      coins: coinsCollected,
      maxCombo: maxComboMultiplier,
      stage: stageIndex + 1,
      nearMisses: nearMissCount,
      time: elapsed,
    };

    // ---- title, sound, score tally ----
    gameoverTitleEl.textContent = isNewBest ? "New Best!" : "Game Over";
    Sound[isNewBest ? "newBest" : "gameOver"]();
    animateCountUp(finalScoreValueEl, finalScore);

    if (isNewBest) {
      scoreDeltaEl.textContent = best === 0 ? "Your first high score!" : `+${finalScore - best} above your previous best!`;
      scoreDeltaEl.className = "score-delta positive";
    } else if (best > 0) {
      scoreDeltaEl.textContent = `${best - finalScore} short of your best (${best})`;
      scoreDeltaEl.className = "score-delta negative";
    } else {
      scoreDeltaEl.textContent = "";
      scoreDeltaEl.className = "score-delta";
    }

    // ---- stats grid ----
    statCoinsEl.textContent = finalStats.coins;
    statComboEl.textContent = `×${finalStats.maxCombo}`;
    statStageEl.textContent = finalStats.stage;
    statNearMissEl.textContent = finalStats.nearMisses;

    // ---- lifetime stats (drive achievement progress) ----
    updateLifetimeStats(finalStats);

    // ---- daily challenge ----
    const challenge = getDailyChallenge();
    const dailyValue = finalStats[challenge.metric];
    const completedMap = loadDailyCompleted();
    const alreadyDoneToday = !!completedMap[challenge.dateStr];
    let justCompletedDaily = false;
    if (!alreadyDoneToday && dailyValue >= challenge.target) {
      completedMap[challenge.dateStr] = true;
      saveDailyCompleted(completedMap);
      justCompletedDaily = true;
    }
    const bestToday = updateDailyBestToday(dailyValue);
    const streak = computeStreak(completedMap, challenge.dateStr);

    if (justCompletedDaily) {
      Sound.dailyComplete();
      dailyResultEl.innerHTML = `<span class="done">✅ Daily Challenge complete!</span> ${challenge.label}${streak > 1 ? ` — 🔥 ${streak} day streak!` : ""}`;
    } else if (alreadyDoneToday) {
      dailyResultEl.innerHTML = `<span class="done">✅ Already completed today's challenge.</span>`;
    } else {
      dailyResultEl.textContent = `📅 ${challenge.label} — ${Math.floor(bestToday)}/${challenge.target} best today`;
    }
    dailyResultEl.classList.remove("hidden");

    // ---- achievements ----
    const unlocked = Achievements.evaluate({ ...getLifetimeMetrics(), isNewBest });
    if (unlocked.length) {
      Sound.achievement();
      unlockedListEl.innerHTML = unlocked.map((a) => `<div>${a.icon} ${a.name} unlocked!</div>`).join("");
      unlockedListEl.classList.remove("hidden");
    } else {
      unlockedListEl.classList.add("hidden");
    }
    renderAchievementBadges();
    renderDailyCard();

    // ---- "one more run" motivation line ----
    let motivation;
    if (best === 0 && isNewBest) {
      motivation = "You just set the bar. Can you top it next run?";
    } else if (isNewBest) {
      motivation = "New personal best! 🎉 Can you push it even further?";
    } else if (justCompletedDaily) {
      motivation = "Daily challenge complete — come back tomorrow for a new one!";
    } else {
      const dailyGap = alreadyDoneToday ? Infinity : challenge.target - dailyValue;
      const dailyCloseThreshold = Math.max(2, Math.round(challenge.target * 0.15));
      const scoreGap = best - finalScore;
      const scoreCloseThreshold = Math.max(40, Math.round(best * 0.08));
      if (dailyGap > 0 && dailyGap <= dailyCloseThreshold) {
        motivation = `So close to today's challenge — just ${Math.ceil(dailyGap)} more!`;
      } else if (scoreGap > 0 && scoreGap <= scoreCloseThreshold) {
        motivation = `Only ${scoreGap} points from your best!`;
      } else {
        const pool = ["One more run?", "Your best is waiting to be broken.", "You can beat that.", "Momentum is on your side — go again!"];
        motivation = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    motivationLineEl.textContent = motivation;

    gameOverScreen.classList.toggle("celebrate", isNewBest);
    gameOverScreen.classList.remove("hidden");
    updateTouchControlsVisibility();

    // impact feedback: colored flash + screen shake
    flashScreen(isNewBest ? "gold" : "red");
    canvasFrame.classList.remove("shake");
    void canvasFrame.offsetWidth;
    canvasFrame.classList.add("shake");

    render();
  }

  // input handling
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state === "ready" || state === "over") startGame();
      else if (state === "playing" && !e.repeat) requestJump();
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      setDuck(true);
    } else if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      togglePause();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") {
      setDuck(false);
    } else if (e.code === "Space" || e.code === "ArrowUp") {
      cutJump();
    }
  });

  canvas.addEventListener("pointerdown", () => {
    if (state === "ready" || state === "over") startGame();
    else if (state === "playing") requestJump();
  });
  canvas.addEventListener("pointerup", cutJump);

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  resumeBtn.addEventListener("click", resumeGame);

  pauseBtn.addEventListener("click", togglePause);

  muteBtn.addEventListener("click", () => {
    const muted = Sound.toggleMute();
    muteBtn.textContent = muted ? "🔇" : "🔊";
  });
  muteBtn.textContent = Sound.isMuted() ? "🔇" : "🔊";

  touchJumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready" || state === "over") startGame();
    else requestJump();
  });
  touchJumpBtn.addEventListener("pointerup", cutJump);
  touchJumpBtn.addEventListener("pointerleave", cutJump);
  touchDuckBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setDuck(true);
    vibrate(8);
  });
  touchDuckBtn.addEventListener("pointerup", () => setDuck(false));
  touchDuckBtn.addEventListener("pointerleave", () => setDuck(false));

  // initial paint
  resetGame();
  startBestEl.textContent = getHighScore();
  renderAchievementBadges();
  renderDailyCard();
  updateTouchControlsVisibility();
  render();
  updateHud();
})();
