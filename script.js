(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 50;

  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const newBestEl = document.getElementById("new-best");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const HIGH_SCORE_KEY = "dashRunnerHighScore";

  const STAND_HEIGHT = 50;
  const DUCK_HEIGHT = 30;
  const PLAYER_X = 90;
  const PLAYER_WIDTH = 40;
  const GRAVITY = 2600;
  const JUMP_VELOCITY = -900;

  const BASE_SPEED = 320;
  const MAX_SPEED = 820;
  const SPEED_RAMP = 5.5; // px/sec^2 added to speed per second survived

  let state = "ready"; // ready | playing | over

  let player, obstacles, speed, elapsed, score, spawnTimer, nextSpawnIn, groundOffset, stars, lastTime;

  function resetGame() {
    player = {
      x: PLAYER_X,
      y: GROUND_Y - STAND_HEIGHT,
      width: PLAYER_WIDTH,
      height: STAND_HEIGHT,
      vy: 0,
      onGround: true,
      ducking: false,
    };
    obstacles = [];
    speed = BASE_SPEED;
    elapsed = 0;
    score = 0;
    spawnTimer = 0;
    nextSpawnIn = randRange(0.9, 1.5);
    groundOffset = 0;
    stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 40),
      r: Math.random() * 1.6 + 0.4,
      twinkle: Math.random() * Math.PI * 2,
    }));
    updateScoreDisplay();
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

  function updateScoreDisplay() {
    scoreEl.textContent = Math.floor(score);
    highScoreEl.textContent = getHighScore();
  }

  function currentSpeed() {
    return Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (roll < 0.68) {
      // ground obstacle (cactus-like block), size varies with difficulty
      const height = randRange(34, 64);
      const width = randRange(22, 38);
      obstacles.push({
        type: "ground",
        x: W + 10,
        y: GROUND_Y - height,
        width,
        height,
      });
    } else {
      // flying obstacle requiring duck
      const height = 26;
      const width = 42;
      const flyY = GROUND_Y - STAND_HEIGHT - randRange(18, 34);
      obstacles.push({
        type: "flying",
        x: W + 10,
        y: flyY,
        width,
        height,
        wingPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function jump() {
    if (state !== "playing") return;
    if (player.onGround && !player.ducking) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
  }

  function setDuck(active) {
    if (state !== "playing") return;
    player.ducking = active && player.onGround;
    player.height = player.ducking ? DUCK_HEIGHT : STAND_HEIGHT;
    player.y = GROUND_Y - player.height;
  }

  function update(dt) {
    elapsed += dt;
    speed = currentSpeed();
    score += dt * (speed / 8);
    updateScoreDisplay();

    groundOffset = (groundOffset + speed * dt) % 40;

    // physics
    if (!player.onGround) {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // spawn obstacles
    spawnTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      const difficultyFactor = Math.min(elapsed / 45, 1);
      nextSpawnIn = randRange(1.15 - difficultyFactor * 0.55, 1.7 - difficultyFactor * 0.7);
      spawnObstacle();
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
      if (o.x + o.width < -10) {
        obstacles.splice(i, 1);
        continue;
      }
      const obstacleBox = {
        x: o.x + 3,
        y: o.y + 3,
        width: o.width - 6,
        height: o.height - 6,
      };
      if (rectsOverlap(playerBox, obstacleBox)) {
        gameOver();
        return;
      }
    }
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#181c39");
    skyGrad.addColorStop(1, "#0d0f1c");
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

  function drawPlayer() {
    const { x, y, width, height } = player;
    const r = 8;

    ctx.fillStyle = player.ducking ? "#f472b6" : "#5eead4";
    roundRect(ctx, x, y, width, height, r);
    ctx.fill();

    // eye
    ctx.fillStyle = "#0d0f1c";
    const eyeX = x + width - 12;
    const eyeY = y + (player.ducking ? 10 : 14);
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();

    // legs (simple motion lines)
    ctx.strokeStyle = "#0d0f1c";
    ctx.lineWidth = 3;
    const legY = y + height;
    const t = (elapsed * 10) % 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, legY);
    ctx.lineTo(x + 8 + (t < 1 ? 4 : -4), legY + 8);
    ctx.moveTo(x + width - 10, legY);
    ctx.lineTo(x + width - 10 + (t < 1 ? -4 : 4), legY + 8);
    ctx.stroke();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "ground") {
        const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
        grad.addColorStop(0, "#fb923c");
        grad.addColorStop(1, "#ea580c");
        ctx.fillStyle = grad;
        roundRect(ctx, o.x, o.y, o.width, o.height, 6);
        ctx.fill();
      } else {
        o.wingPhase += 0.25;
        const flap = Math.sin(o.wingPhase) * 8;
        ctx.fillStyle = "#f87171";
        roundRect(ctx, o.x, o.y, o.width, o.height, 8);
        ctx.fill();
        ctx.strokeStyle = "#fecaca";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(o.x + o.width / 2, o.y + o.height / 2);
        ctx.lineTo(o.x + o.width / 2 - 14, o.y + o.height / 2 - flap);
        ctx.moveTo(o.x + o.width / 2, o.y + o.height / 2);
        ctx.lineTo(o.x + o.width / 2 + 14, o.y + o.height / 2 - flap);
        ctx.stroke();
      }
    }
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
    drawObstacles();
    drawPlayer();
  }

  function loop(timestamp) {
    if (state !== "playing") return;
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 0.05); // avoid huge jumps on tab switch
    lastTime = timestamp;

    update(dt);
    if (state !== "playing") return; // gameOver may have triggered mid-update
    render();
    requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    state = "playing";
    lastTime = null;
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state = "over";
    const finalScore = Math.floor(score);
    const best = getHighScore();
    const isNewBest = finalScore > best;
    if (isNewBest) setHighScore(finalScore);

    updateScoreDisplay();
    finalScoreEl.textContent = `Score: ${finalScore}`;
    newBestEl.classList.toggle("hidden", !isNewBest);
    gameOverScreen.classList.remove("hidden");

    render();
  }

  // input handling
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state === "ready") startGame();
      else if (state === "over") startGame();
      else jump();
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      setDuck(true);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") {
      setDuck(false);
    }
  });

  canvas.addEventListener("pointerdown", () => {
    if (state === "ready") startGame();
    else if (state === "playing") jump();
    else if (state === "over") startGame();
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // initial paint
  resetGame();
  render();
  updateScoreDisplay();
})();
