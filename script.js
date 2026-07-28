(() => {
  "use strict";

  const STORAGE_KEY = "shield_agent_codename";
  const AUDIO_KEY = "shield_audio_enabled";

  const state = {
    codename: localStorage.getItem(STORAGE_KEY) || "",
    audioEnabled: localStorage.getItem(AUDIO_KEY) !== "false",
    countdownTimer: null,
  };

  const screens = Array.from(document.querySelectorAll(".screen"));
  let introComplete = false;
  const codenameForm = document.getElementById("codenameForm");
  const codenameInput = document.getElementById("codenameInput");
  const codenameError = document.getElementById("codenameError");
  const codenameDisplays = document.querySelectorAll('[data-role="codename-display"]');

  const acceptBriefingBtn = document.getElementById("acceptBriefingBtn");

  const briefingVideo = document.getElementById("briefingVideo");
  const countdownReadout = document.getElementById("countdownReadout");
  const intelModal = document.getElementById("intelModal");
  const continueMissionBtn = document.getElementById("continueMissionBtn");

  const acceptMissionBtn = document.getElementById("acceptMissionBtn");
  const confirmationMsg = document.getElementById("confirmationMsg");
  const ticketEl = document.getElementById("ticket");

  const declineBtn = document.getElementById("declineBtn");
  const declineZone = document.getElementById("declineZone");

  const audioToggle = document.getElementById("audioToggle");
  const audioToggleLabel = document.getElementById("audioToggleLabel");

  const toastEl = document.getElementById("toast");

  /* ---------------------------------------------------------------------
     SCREEN MANAGEMENT
     --------------------------------------------------------------------- */
  function showScreen(index) {
    screens.forEach((s) => s.classList.toggle("active", s.dataset.screen === String(index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setCodename(name) {
    state.codename = name;
    localStorage.setItem(STORAGE_KEY, name);
    codenameDisplays.forEach((el) => (el.textContent = name));
  }

  // Restore a previously-saved codename on load (state persistence)
  if (state.codename) {
    codenameInput.value = state.codename;
    setCodename(state.codename);
  }

  /* ---------------------------------------------------------------------
     WEB AUDIO — SYNTHESIZED UI / WEB-SHOOTER FX (no external audio files)
     --------------------------------------------------------------------- */
  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Generic oscillator blip with an envelope
  function tone({ freq = 440, duration = 0.15, type = "sine", gain = 0.2, delay = 0, glideTo = null }) {
    if (!state.audioEnabled) return;
    const ctx = ensureAudioContext();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (glideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), ctx.currentTime + delay + duration);
    }
    amp.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  // Short filtered white-noise burst — used to add "thwip" texture to the web-shooter FX
  function noiseBurst({ duration = 0.12, gain = 0.15, delay = 0, filterFreq = 2200 }) {
    if (!state.audioEnabled) return;
    const ctx = ensureAudioContext();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime + delay);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

    noise.connect(filter).connect(amp).connect(ctx.destination);
    noise.start(ctx.currentTime + delay);
  }

  const SFX = {
    verify() {
      tone({ freq: 320, duration: 0.09, type: "square", gain: 0.15 });
      tone({ freq: 640, duration: 0.12, type: "square", gain: 0.15, delay: 0.09 });
    },
    accept() {
      tone({ freq: 220, duration: 0.1, type: "sawtooth", gain: 0.12 });
      tone({ freq: 440, duration: 0.12, type: "sawtooth", gain: 0.12, delay: 0.08 });
      tone({ freq: 880, duration: 0.16, type: "sine", gain: 0.1, delay: 0.16 });
    },
    alert() {
      tone({ freq: 700, duration: 0.14, type: "square", gain: 0.15 });
      tone({ freq: 500, duration: 0.14, type: "square", gain: 0.15, delay: 0.16 });
    },
    webShooter() {
      // classic descending "thwip" — quick pitch drop + noise burst
      tone({ freq: 2600, glideTo: 300, duration: 0.14, type: "sawtooth", gain: 0.18 });
      noiseBurst({ duration: 0.1, gain: 0.2, filterFreq: 3200 });
    },
    granted() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ freq: f, duration: 0.2, type: "triangle", gain: 0.14, delay: i * 0.08 });
      });
    },
    tick() {
      tone({ freq: 880, duration: 0.05, type: "square", gain: 0.06 });
    },
    introReveal() {
      // cinematic low-boom for title reveal
      tone({ freq: 120, duration: 0.4, type: "sine", gain: 0.2 });
      tone({ freq: 180, duration: 0.3, type: "triangle", gain: 0.12, delay: 0.1 });
      tone({ freq: 440, duration: 0.15, type: "triangle", gain: 0.08, delay: 0.5 });
      noiseBurst({ duration: 0.15, gain: 0.1, filterFreq: 800, delay: 0.05 });
    },
    introAdvance() {
      tone({ freq: 880, duration: 0.08, type: "sine", gain: 0.1 });
      tone({ freq: 1320, duration: 0.1, type: "square", gain: 0.08, delay: 0.06 });
    },
  };

  /* ---------------------------------------------------------------------
     AUDIO TOGGLE
     --------------------------------------------------------------------- */
  function refreshAudioToggleUI() {
    audioToggle.classList.toggle("muted", !state.audioEnabled);
    audioToggle.setAttribute("aria-pressed", String(state.audioEnabled));
    audioToggleLabel.textContent = `AUDIO: ${state.audioEnabled ? "ON" : "OFF"}`;
  }
  refreshAudioToggleUI();

  audioToggle.addEventListener("click", () => {
    ensureAudioContext();
    state.audioEnabled = !state.audioEnabled;
    localStorage.setItem(AUDIO_KEY, String(state.audioEnabled));
    refreshAudioToggleUI();
if (state.audioEnabled) tone({ freq: 500, duration: 0.08, type: "sine", gain: 0.12 });
  });

  /* ---------------------------------------------------------------------
     INTRO SCREEN -> STEP 0 : GAME SPLASH / TITLE CARD
     --------------------------------------------------------------------- */
  // Automatically play intro reveal sound shortly after page loads
  setTimeout(() => {
    ensureAudioContext();
    SFX.introReveal();
  }, 800);

  // Advance from intro to codename screen
  function advanceFromIntro() {
    if (introComplete) return;
    introComplete = true;

    ensureAudioContext();
    SFX.introAdvance();
    showScreen(0);
    codenameInput.focus();
  }

  // Auto-advance after ~5 seconds
  const introAutoTimer = setTimeout(advanceFromIntro, 5000);

  // Click anywhere on intro to advance
  const introScreen = document.getElementById("screen-intro");
  if (introScreen) {
    introScreen.addEventListener("click", () => {
      clearTimeout(introAutoTimer);
      advanceFromIntro();
    });
  }

  // Keyboard: Enter or Space to advance
  document.addEventListener("keydown", function onIntroKey(e) {
    if (introComplete) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      clearTimeout(introAutoTimer);
      advanceFromIntro();
      document.removeEventListener("keydown", onIntroKey);
    }
  });

  /* ---------------------------------------------------------------------
     STEP 0 -> STEP 1 : IDENTITY VERIFICATION
     --------------------------------------------------------------------- */
  codenameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    ensureAudioContext();
    const name = codenameInput.value.trim().toUpperCase();

    if (!name) {
      codenameError.classList.add("show");
      tone({ freq: 160, duration: 0.2, type: "sawtooth", gain: 0.15 });
      return;
    }
    codenameError.classList.remove("show");
    setCodename(name);
    SFX.verify();
    showScreen(1);
  });

  /* ---------------------------------------------------------------------
     STEP 1 -> STEP 2 : ACCEPT BRIEFING
     --------------------------------------------------------------------- */
  acceptBriefingBtn.addEventListener("click", () => {
    ensureAudioContext();
    SFX.webShooter();
    showScreen(2);
    initVideoStep();
  });

  /* ---------------------------------------------------------------------
     STEP 2 : VIDEO + 10-SECOND HUD COUNTDOWN
     --------------------------------------------------------------------- */
  // Allow clicking the countdown to skip straight to the intel modal
  countdownReadout.addEventListener("click", () => {
    ensureAudioContext();
    if (!state.countdownTimer) return; // already completed
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
    briefingVideo.pause();
    countdownReadout.textContent = "ANALYSIS COMPLETE";
    SFX.alert();
    openIntelModal();
  });

  let videoStepInitialized = false;

  function initVideoStep() {
    if (videoStepInitialized) return; // only run the countdown/video sequence once
    videoStepInitialized = true;

    // Attempt autoplay of the local/placeholder video feed
    briefingVideo.currentTime = 0;
    const playPromise = briefingVideo.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        /* Autoplay may be blocked until user interaction; browser will
           show the video paused, which is an acceptable fallback. */
      });
    }

    let secondsLeft = 2 * 60 + 35; // 2 minutes, 35 seconds
    countdownReadout.textContent = `ANALYZING SENSORS: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} | Click to Skip`;

    state.countdownTimer = setInterval(() => {
      secondsLeft -= 1;
      SFX.tick();

      if (secondsLeft > 0) {
        countdownReadout.textContent = `ANALYZING SENSORS: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} | Click to Skip`;
      } else {
        countdownReadout.textContent = "ANALYSIS COMPLETE";
        clearInterval(state.countdownTimer);
        briefingVideo.pause();
        openIntelModal();
      }
    }, 1000);
  }

  function openIntelModal() {
    SFX.alert();
    intelModal.classList.add("show");
  }

  /* ---------------------------------------------------------------------
     STEP 3 -> STEP 4 : CONTINUE MISSION
     --------------------------------------------------------------------- */
  continueMissionBtn.addEventListener("click", () => {
    ensureAudioContext();
    SFX.webShooter();
    intelModal.classList.remove("show");
    showScreen(3);
  });

/* ---------------------------------------------------------------------
     STEP 4 : DEPLOYMENT TICKET — ACCEPT MISSION
     --------------------------------------------------------------------- */
  acceptMissionBtn.addEventListener("click", () => {
    ensureAudioContext();
    SFX.granted();
    ticketEl.classList.add("accepted");
    confirmationMsg.classList.add("show");
    acceptMissionBtn.disabled = true;

    // Trigger Sticker Pop-in Animation
    const stickers = ticketEl.querySelectorAll(".sticker");
    stickers.forEach((sticker, index) => {
      // Add a tiny stagger delay between stickers for extra pop effect
      setTimeout(() => {
        sticker.classList.add("visible");
      }, index * 150);
    });

    if (window.confetti) {
      const colors = ["#ff0033", "#00e5ff", "#ffffff"];
      window.confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 },
        colors,
        scalar: 0.9,
      });
      window.confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      window.confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
    }
  });
  
  /* ---------------------------------------------------------------------
     STEP 4 : DECLINE — EVASIVE BUTTON MECHANICS
     --------------------------------------------------------------------- */
  function teleportDeclineButton(cursorX, cursorY) {
    if (ticketEl.classList.contains("accepted")) return; // stop taunting once mission is accepted

    const btnRect = declineBtn.getBoundingClientRect();
    const margin = 16;
    const maxX = window.innerWidth - btnRect.width - margin;
    const maxY = window.innerHeight - btnRect.height - margin;

    let x = Math.random() * Math.max(maxX, 0) + margin / 2;
    let y = Math.random() * Math.max(maxY, 0) + margin / 2;

    // Bias the new position away from the cursor when we know where it is
    if (typeof cursorX === "number") {
      const awayX = cursorX < window.innerWidth / 2 ? maxX * 0.65 : maxX * 0.05;
      const awayY = cursorY < window.innerHeight / 2 ? maxY * 0.65 : maxY * 0.05;
      x = awayX + Math.random() * (maxX * 0.3);
      y = awayY + Math.random() * (maxY * 0.3);
    }

    declineBtn.style.position = "fixed";
    declineBtn.style.left = `${Math.max(margin, Math.min(x, maxX))}px`;
    declineBtn.style.top = `${Math.max(margin, Math.min(y, maxY))}px`;
    declineBtn.style.margin = "0";
    declineBtn.style.transform = `rotate(${(Math.random() * 12 - 6).toFixed(1)}deg)`;
  }

  declineBtn.addEventListener("mouseenter", (e) => {
    teleportDeclineButton(e.clientX, e.clientY);
  });
  declineBtn.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    teleportDeclineButton(touch ? touch.clientX : undefined, touch ? touch.clientY : undefined);
  }, { passive: true });

  // In the rare event it does get clicked (e.g. keyboard focus + Enter)
  declineBtn.addEventListener("click", () => {
    ensureAudioContext();
    SFX.webShooter();
    showToast(`Option Disabled: Agent ${state.codename || "AGENT"}, Spider-Man needs you!`);
    teleportDeclineButton();
  });

  declineBtn.addEventListener("focus", () => {
    teleportDeclineButton();
  });

  /* ---------------------------------------------------------------------
     TOAST NOTIFICATIONS
     --------------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }
})();
