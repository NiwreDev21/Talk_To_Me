
/* =============================================
   TALK TO ME — English Learning App
   app.js — Complete Application Logic
   ============================================= */

'use strict';

// ============ CONSTANTS ============
const PHRASE_BANK = [
  "These days, I'm pretty busy with my routine.",
  "Right now I'm just here, talking to myself.",
  "Today I want to talk about my daily routine.",
  "I've been trying to improve my English every day.",
  "Let me tell you about something that happened today.",
  "I think the most important thing right now is to practice.",
  "Every morning, I wake up and try to think in English.",
  "I want to describe my room and everything in it.",
  "Something I find challenging about English is the pronunciation.",
  "I'm going to try to speak for one full minute without stopping.",
  "Let me talk about a movie I watched recently.",
  "I have a lot of things on my mind today.",
  "One of my favorite things about learning English is the music.",
  "I want to improve my English so I can travel more.",
  "Let me tell you about my plans for this week.",
  "I was _ but _ so I _ then _.",
  "I think _ because _ also _ so_ ",
  "I used to _ but now I _ because_ so_ ",
  "the thing is _ so _ I mean _ that's why _",
];

const AC = {
  "i have": ["I have a dog.", "I have been studying for two hours.", "I have never been to London."],
  "i want": ["I want to improve my English.", "I want to travel someday.", "I want to tell you something."],
  "i think": ["I think English is fascinating.", "I think I need more practice.", "I think the best way to learn is to speak."],
  "i can": ["I can speak a little English.", "I can understand most things.", "I can try to explain."],
  "i would": ["I would like to learn more.", "I would love to travel.", "I would say it's getting easier."],
  "there is": ["There is a big difference.", "There is something I want to say.", "There is a lot to learn."],
  "i need": ["I need to practice more.", "I need to improve my pronunciation.", "I need to listen more carefully."],
};

const XP_PER_LEVEL = 1000;
const LEVEL_TITLES = [
  { min: 0, title: 'Beginner Speaker' },
  { min: 3, title: 'Language Enthusiast' },
  { min: 6, title: 'Fluent Explorer' },
  { min: 10, title: 'English Master' },
];

const TAGLINES = [
  'Every practice brings you closer to fluency.',
  'Your progress is solid and consistent.',
  'Your climb is steady and impressive.',
  "You're very close to the next level.",
];

const AI_TUTOR_SYSTEM_INSTRUCTION =
  "You are a friendly, patient English-speaking tutor inside the 'Talk to Me' app. " +
  "Have a natural spoken conversation in English with the learner to help them practice. " +
  "Keep your responses conversational and not too long. Gently correct significant mistakes " +
  "without breaking the flow too much, and encourage the learner to keep talking.";

// ============ INDEXEDDB ============
let db;

function openDB() {
  return new Promise((res, rej) => {
    if (db) return res(db);
    const req = indexedDB.open('EchoDB', 3);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('phrases')) {
        d.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('estructuras')) {
        d.createObjectStore('estructuras', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('audio')) {
        const as = d.createObjectStore('audio', { keyPath: 'id', autoIncrement: true });
        as.createIndex('byPhrase', 'phraseId');
        as.createIndex('byPhraseRole', ['phraseId','role']);
      }
      if (!d.objectStoreNames.contains('mazos')) {
        d.createObjectStore('mazos', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('stats')) {
        d.createObjectStore('stats', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('cfg')) {
        d.createObjectStore('cfg', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = () => rej(req.error);
  });
}

function idbGet(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbPut(store, value) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    const r = tx.objectStore(store).put(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbDelete(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  }));
}

function idbGetAll(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbGetByIndex(store, index, value) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).index(index).getAll(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

async function saveAudioBlob(phraseId, role, blob, name) {
  const existing = await getAudioRecord(phraseId, role);
  if (existing) await idbDelete('audio', existing.id);
  return idbPut('audio', { phraseId, role, blob, name: name || role, created: Date.now() });
}

async function getAudioRecord(phraseId, role) {
  const results = await idbGetByIndex('audio', 'byPhraseRole', [phraseId, role]);
  return results[0] || null;
}

function blobURL(blob) {
  return URL.createObjectURL(blob);
}

// ============ STATE ============
let state = {
  currentModule: 'dictado',
  currentScreen: 'home', // 'home' | 'profile'
  phrases: [],
  mazos: {},
  stats: {
    sessions: 0, minutes: 0,
    avgPronun: 0, pronunCount: 0,
    streak: 0, lastDate: null,
    bestWPM: 0, bestFluency: 0, wordsTotal: 0,
    xp: 0,
  },
  cfg: {
    notifEnabled: false, notifTime: '09:00', userName: 'Your name',
    aiProvider: null,       // 'own' | 'developer' | null
    geminiApiKey: '',
  },
  pronun: { phraseId: null, recognition: null, listening: false },
  dictado: { recognition: null, active: false, finalText: '', currentPhrase: '', duration: 'free' },
  ai: {
    client: null,
    status: 'idle', // idle | connecting | ready | listening | speaking
    sessionActive: false,
    currentUserBubble: null,
    currentModelBubble: null,
  },
};

const activePlayers = new Map();

// ============ TOAST ============
const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info' };

function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon-wrap"><span class="msi">${TOAST_ICONS[type] || TOAST_ICONS.info}</span></span>
    <span class="toast-msg"></span>
    <button class="toast-close" aria-label="Close" type="button">×</button>
    <span class="toast-progress" style="animation-duration:${duration}ms"></span>
  `;
  el.querySelector('.toast-msg').textContent = msg;
  container.appendChild(el);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.add('hide');
    setTimeout(() => el.remove(), 220);
  };

  el.querySelector('.toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// ============ AUDIO PLAYER COMPONENT ============
function createAudioPlayer(blob, opts = {}) {
  const { showLoop = true, showSpeed = true, id = Math.random().toString(36).slice(2) } = opts;
  const url = blobURL(blob);
  const audio = new Audio(url);
  audio.preload = 'metadata';

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let speedIdx = 2;
  let looping = false;

  const wrap = document.createElement('div');
  wrap.className = 'audio-player';
  wrap.dataset.playerId = id;

  const playBtn = document.createElement('button');
  playBtn.className = 'ap-btn';
  playBtn.textContent = '▶';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'ap-progress-wrap';
  const progressTrack = document.createElement('div');
  progressTrack.className = 'ap-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'ap-progress-fill';
  progressTrack.appendChild(progressFill);
  progressWrap.appendChild(progressTrack);

  const timeEl = document.createElement('div');
  timeEl.className = 'ap-time';
  timeEl.textContent = '0:00 / 0:00';

  const speedBtn = document.createElement('button');
  speedBtn.className = 'ap-speed';
  speedBtn.textContent = '1×';

  const loopBtn = document.createElement('button');
  loopBtn.className = 'ap-btn ap-loop';
  loopBtn.textContent = '↺';
  loopBtn.title = 'Loop';

  function fmtTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
  }

  audio.addEventListener('loadedmetadata', () => {
    timeEl.textContent = `0:00 / ${fmtTime(audio.duration)}`;
  });

  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressFill.style.width = pct + '%';
    timeEl.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
  });

  audio.addEventListener('play', () => { playBtn.innerHTML = '<span class="msi">pause</span>'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });

  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    if (looping) {
      setTimeout(() => audio.play(), 300);
      if (opts.onLoop) opts.onLoop();
    } else {
      if (opts.onEnd) opts.onEnd();
    }
  });

  playBtn.addEventListener('click', () => {
    activePlayers.forEach((ap, pid) => { if (pid !== id) ap.pause(); });
    if (audio.paused) audio.play();
    else audio.pause();
  });

  progressWrap.addEventListener('click', e => {
    const rect = progressTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = audio.duration * ratio;
  });

  if (showSpeed) {
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      audio.playbackRate = speeds[speedIdx];
      speedBtn.textContent = speeds[speedIdx] + '×';
    });
  }

  if (showLoop) {
    loopBtn.addEventListener('click', () => {
      looping = !looping;
      loopBtn.classList.toggle('active', looping);
    });
  }

  wrap.appendChild(playBtn);
  wrap.appendChild(progressWrap);
  wrap.appendChild(timeEl);
  if (showSpeed) wrap.appendChild(speedBtn);
  if (showLoop) wrap.appendChild(loopBtn);

  const api = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.currentTime = 0; },
    setLoop: v => { looping = v; loopBtn.classList.toggle('active', v); },
    isLooping: () => looping,
    el: wrap,
    audio,
    id,
  };

  activePlayers.set(id, api);
  return api;
}

// ============ NAVIGATION (mode switcher: Dictation / Pronunciation) ============
function switchModule(mod) {
  document.querySelectorAll('.module-panel').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('module-' + mod);
  if (el) el.classList.add('active');
  state.currentModule = mod;

  stopDictado();
  stopPronun();

  renderModeSwitcher();

  const durationRow = document.getElementById('duration-row');
  if (durationRow) durationRow.classList.toggle('hidden', mod !== 'dictado');

  if (mod === 'pronun') populatePronunSelect();
}

function renderModeSwitcher() {
  const icon = document.getElementById('mode-switcher-icon');
  const label = document.getElementById('mode-switcher-label');
  if (state.currentModule === 'dictado') {
    if (icon) icon.textContent = 'keyboard_voice';
    if (label) label.textContent = 'Dictation';
  } else {
    if (icon) icon.textContent = 'graphic_eq';
    if (label) label.textContent = 'Pronunciation';
  }
  document.querySelectorAll('.mode-dropdown-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.module === state.currentModule);
  });
}

function toggleModeDropdown(force) {
  const dd = document.getElementById('mode-dropdown');
  if (!dd) return;
  const show = force !== undefined ? force : dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !show);
}

// ============ SCREEN NAVIGATION (home <-> profile) ============
function goToScreen(screen) {
  state.currentScreen = screen;
  document.getElementById('home-section').classList.toggle('active', screen === 'home');
  document.getElementById('profile-section').classList.toggle('active', screen === 'profile');
  document.getElementById('topbar-back-btn').classList.toggle('hidden', screen === 'home');
  document.getElementById('topbar-logo').classList.toggle('hidden', screen !== 'home');
  document.getElementById('fab-create-mazo').classList.toggle('hidden', screen !== 'home');

  if (screen === 'profile') {
    stopDictado();
    stopPronun();
    renderProfileScreen();
  }
}

// ============ DATA / GREETING ============
async function loadData() {
  state.phrases = await idbGetAll('phrases');
  const mazoRecords = await idbGetAll('mazos');
  state.mazos = {};
  for (const m of mazoRecords) state.mazos[m.id] = m.phraseIds || [];
  const statsRec = await idbGet('stats', 'main');
  if (statsRec) state.stats = { ...state.stats, ...statsRec };
  const cfgRec = await idbGet('cfg', 'main');
  if (cfgRec) state.cfg = { ...state.cfg, ...cfgRec };
  renderGreeting();
  renderLevelBadge();
  renderRecordBadge();
  renderDesktopStats();
}

function renderGreeting() {
  const el = document.getElementById('home-username');
  if (el) el.textContent = state.cfg.userName || 'Your name';
}

function renderRecordBadge() {
  const el = document.getElementById('home-record-wpm');
  if (el) el.textContent = state.stats.bestWPM || 0;
}

// ============ DESKTOP SIDEBAR STATS (real data only, desktop/tablet view) ============
function renderDesktopStats() {
  const words = document.getElementById('side-stat-words');
  const wpm = document.getElementById('side-stat-wpm');
  const fluency = document.getElementById('side-stat-fluency');
  const pronun = document.getElementById('side-stat-pronun');
  const sessions = document.getElementById('side-stat-sessions');
  if (words) words.textContent = state.stats.wordsTotal || 0;
  if (wpm) wpm.textContent = state.stats.bestWPM || 0;
  if (fluency) fluency.textContent = (state.stats.bestFluency || 0) + '%';
  if (pronun) pronun.textContent = (state.stats.avgPronun || 0) + '%';
  if (sessions) sessions.textContent = state.stats.sessions || 0;
}

// ============ XP / LEVEL SYSTEM ============
function getLevelInfo() {
  const xp = state.stats.xp || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  let title = LEVEL_TITLES[0].title;
  for (const t of LEVEL_TITLES) if (level >= t.min + 1 || (t.min === 0)) { if (level - 1 >= t.min) title = t.title; }
  return { xp, level, xpIntoLevel, pct, title };
}

async function addXP(amount) {
  const before = getLevelInfo().level;
  state.stats.xp = (state.stats.xp || 0) + amount;
  await idbPut('stats', { id: 'main', ...state.stats });
  const after = getLevelInfo().level;
  renderLevelBadge();
  if (after > before) toast(`You reached level ${after}! 🎉`, 'success');
}

function renderLevelBadge() {
  const { level } = getLevelInfo();
  const lvNum = document.getElementById('lv-num');
  if (lvNum) lvNum.textContent = level;
}

function renderProfileScreen() {
  const { xp, level, xpIntoLevel, pct, title } = getLevelInfo();
  document.getElementById('profile-name-display').textContent = state.cfg.userName || 'Your name';
  document.getElementById('profile-title-text').textContent = title;
  document.getElementById('xp-bar-fill').style.width = pct + '%';
  document.getElementById('xp-current').textContent = xpIntoLevel;
  document.getElementById('xp-target').textContent = XP_PER_LEVEL;
  document.getElementById('xp-next-level').textContent = level + 1;
  document.getElementById('profile-tagline').textContent = TAGLINES[Math.min(TAGLINES.length - 1, Math.floor(pct / 30))];

  document.getElementById('metric-best-wpm').textContent = `${state.stats.bestWPM || 0} WPM`;
  document.getElementById('metric-fluency').textContent = `${state.stats.bestFluency || 0}%`;

  document.getElementById('cfg-username').value = state.cfg.userName || 'Your name';
  document.getElementById('cfg-notif').checked = !!state.cfg.notifEnabled;
  document.getElementById('cfg-notif-time').value = state.cfg.notifTime || '09:00';

  renderAISettingsSection();
}

async function saveProfileSettings() {
  const name = document.getElementById('cfg-username').value.trim();
  state.cfg.userName = name || 'Your name';
  state.cfg.notifEnabled = document.getElementById('cfg-notif').checked;
  state.cfg.notifTime = document.getElementById('cfg-notif-time').value || '09:00';
  await idbPut('cfg', { id: 'main', ...state.cfg });
  renderGreeting();
  renderProfileScreen();
  toast('Profile updated', 'success');
}

// ============ PRONUNCIATION ============
let recognition = null;
let pronunNativeBlob = null;
let pronunFinalText = '';
let pronunTextVisible = false; // tracks Show/Hide state for the whole session on the current card

function setPronunShowBtnLabel(visible) {
  const btn = document.getElementById('pronun-show-btn');
  if (!btn) return;
  if (visible) {
    btn.innerHTML = '<span class="msi">visibility_off</span> Hide Text';
  } else {
    btn.innerHTML = '<span class="msi">visibility</span> Show Text';
  }
}

async function populatePronunSelect() {
  const sel = document.getElementById('pronun-phrase-select');
  sel.innerHTML = '<option value="">— Select card —</option>';
  for (const p of state.phrases) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.title || p.text?.slice(0, 40) || 'Untitled';
    sel.appendChild(opt);
  }
  if (state.pronun.phraseId) {
    sel.value = state.pronun.phraseId;
    loadPronunPhrase(state.pronun.phraseId);
  }
}

async function loadPronunPhrase(phraseId) {
  state.pronun.phraseId = phraseId;
  const phrase = state.phrases.find(p => p.id === phraseId);
  if (!phrase) return;

  const textEl = document.getElementById('recog-text-display');
  textEl.textContent = phrase.text || '';
  pronunTextVisible = false;
  textEl.classList.add('blurred');
  setPronunShowBtnLabel(false);
  document.getElementById('pronun-show-btn').style.display = '';
  document.getElementById('pronun-start-btn').disabled = false;

  resetPronunResults();

  pronunNativeBlob = null;
  const audioWrap = document.getElementById('pronun-audio-wrap');
  const uploadRow = document.getElementById('pronun-audio-upload');
  audioWrap.innerHTML = '';
  const rec = await getAudioRecord(phraseId, 'original');
  if (rec) {
    pronunNativeBlob = rec.blob;
    const player = createAudioPlayer(rec.blob, { showLoop: false });
    audioWrap.appendChild(player.el);
    uploadRow.classList.add('hidden');
  } else {
    uploadRow.classList.remove('hidden');
  }
}

function resetPronunResults() {
  document.getElementById('pronun-live-wrap').classList.add('hidden');
  document.getElementById('pronun-analyzing').classList.add('hidden');
  document.getElementById('pronun-results').classList.add('hidden');
  document.getElementById('pronun-start-btn').classList.remove('hidden');
  document.getElementById('pronun-cta-label').classList.remove('hidden');
  document.getElementById('pronun-stop-btn').classList.add('hidden');
  document.getElementById('listening-state').classList.add('hidden');
}

document.getElementById('pronun-audio-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  const phraseId = state.pronun.phraseId;
  if (!file || !phraseId) return;
  await saveAudioBlob(phraseId, 'original', file, 'reference');
  pronunNativeBlob = file;
  const audioWrap = document.getElementById('pronun-audio-wrap');
  audioWrap.innerHTML = '';
  const player = createAudioPlayer(file, { showLoop: false });
  audioWrap.appendChild(player.el);
  document.getElementById('pronun-audio-upload').classList.add('hidden');
  toast('Reference audio saved', 'success');
});

async function startPronun() {
  const phraseId = state.pronun.phraseId;
  if (!phraseId) { toast('Select a card', 'error'); return; }

  const phrase = state.phrases.find(p => p.id === phraseId);
  if (!phrase || !phrase.text) { toast('This card has no text', 'error'); return; }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Your browser does not support speech recognition. Use Chrome.', 'error');
    return;
  }

  resetPronunResults();
  pronunFinalText = '';

  document.getElementById('listening-state').classList.remove('hidden');
  document.getElementById('pronun-start-btn').classList.add('hidden');
  document.getElementById('pronun-cta-label').classList.add('hidden');
  document.getElementById('pronun-stop-btn').classList.remove('hidden');

  const liveWrap = document.getElementById('pronun-live-wrap');
  const liveFinalEl = document.getElementById('pronun-live-text');
  const liveInterimEl = document.getElementById('pronun-live-interim');
  liveFinalEl.textContent = '';
  liveInterimEl.textContent = '';
  liveWrap.classList.remove('hidden');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = e => {
    let finalText = '';
    let interimText = '';
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += transcript + ' ';
      else interimText += transcript;
    }
    pronunFinalText = finalText.trim();
    liveFinalEl.textContent = pronunFinalText;
    liveInterimEl.textContent = interimText;
  };

  recognition.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast('Recognition error: ' + e.error, 'error');
    }
  };

  recognition.start();
  state.pronun.listening = true;
}

function stopPronun() {
  state.pronun.listening = false;
  document.getElementById('listening-state').classList.add('hidden');
  document.getElementById('pronun-start-btn').classList.remove('hidden');
  document.getElementById('pronun-cta-label').classList.remove('hidden');
  document.getElementById('pronun-stop-btn').classList.add('hidden');

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }

  if (!state.pronun.phraseId) return;

  document.getElementById('pronun-live-wrap').classList.add('hidden');
  document.getElementById('pronun-analyzing').classList.remove('hidden');

  const phrase = state.phrases.find(p => p.id === state.pronun.phraseId);
  analyzeFullPronunciation(phrase?.text || '', pronunFinalText).then(() => {
    document.getElementById('pronun-analyzing').classList.add('hidden');
  });
}

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z']/g, '');
}

async function analyzeFullPronunciation(original, spoken) {
  const origWords = original.split(/\s+/).map(normalizeWord).filter(Boolean);
  const spokWords = spoken.split(/\s+/).map(normalizeWord).filter(Boolean);

  const floatTextEl = document.getElementById('pronun-float-text');
  floatTextEl.innerHTML = '';

  let correct = 0;
  origWords.forEach(word => {
    const span = document.createElement('span');
    const found = spokWords.includes(word);
    span.className = found ? 'word-correct' : 'word-wrong';
    if (found) correct++;
    span.textContent = word;
    floatTextEl.appendChild(span);
    floatTextEl.appendChild(document.createTextNode(' '));
  });

  const overall = origWords.length > 0 ? Math.round((correct / origWords.length) * 100) : 0;
  renderPronunResults(overall);

  // ---- Stats ----
  state.stats.pronunCount = (state.stats.pronunCount || 0) + 1;
  const prevTotal = (state.stats.avgPronun || 0) * ((state.stats.pronunCount || 1) - 1);
  state.stats.avgPronun = Math.round((prevTotal + overall) / state.stats.pronunCount);
  if (overall > (state.stats.bestFluency || 0)) state.stats.bestFluency = overall;
  await idbPut('stats', { id: 'main', ...state.stats });
  await addXP(15);
  renderDesktopStats();
}

function renderPronunResults(overall) {
  document.getElementById('pronun-results').classList.remove('hidden');

  const arc = document.getElementById('score-circle-arc');
  const circumference = 314;
  arc.style.transition = 'stroke-dashoffset 0.8s ease';
  arc.style.strokeDashoffset = circumference - (overall / 100) * circumference;
  arc.style.stroke = overall >= 80 ? 'var(--accent)' : overall >= 60 ? 'var(--orange)' : 'var(--red)';
  document.getElementById('score-num').textContent = overall + '%';
}

document.getElementById('pronun-start-btn').addEventListener('click', startPronun);
document.getElementById('pronun-stop-btn').addEventListener('click', stopPronun);

// ============ DICTADO ============
let dictadoRecognition = null;
let dictadoActive = false;
let finalText = '';
let dictadoSessionId = 0;

// Timer
let dictadoTimerInterval = null;
let dictadoStartTs = 0;
let dictadoElapsedMs = 0;

function fmtTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getDurationMs() {
  const d = state.dictado.duration;
  if (d === 'free') return null;
  return Number(d) * 1000;
}

function startDictadoTimer() {
  dictadoStartTs = Date.now() - dictadoElapsedMs;
  const durationMs = getDurationMs();
  dictadoTimerInterval = setInterval(() => {
    dictadoElapsedMs = Date.now() - dictadoStartTs;
    if (durationMs != null) {
      const remaining = Math.max(0, durationMs - dictadoElapsedMs);
      document.getElementById('dictado-timer').textContent = fmtTimer(remaining);
      if (remaining <= 0) {
        stopDictado();
        return;
      }
    } else {
      document.getElementById('dictado-timer').textContent = fmtTimer(dictadoElapsedMs);
    }
  }, 250);
}

function stopDictadoTimer() {
  if (dictadoTimerInterval) clearInterval(dictadoTimerInterval);
  dictadoTimerInterval = null;
}

function resetDictadoTimer() {
  stopDictadoTimer();
  dictadoElapsedMs = 0;
  const durationMs = getDurationMs();
  document.getElementById('dictado-timer').textContent = durationMs != null ? fmtTimer(durationMs) : '00:00';
}

function normalizeForOverlap(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stripDictadoOverlap(existingText, newWordsArr) {
  const existingWords = existingText.trim().split(/\s+/).filter(Boolean).map(normalizeForOverlap);
  const newWordsNorm = newWordsArr.map(normalizeForOverlap);
  const maxOverlap = Math.min(existingWords.length, newWordsNorm.length, 12);
  for (let len = maxOverlap; len > 0; len--) {
    const tail = existingWords.slice(-len).join(' ');
    const head = newWordsNorm.slice(0, len).join(' ');
    if (tail && tail === head) {
      return newWordsArr.slice(len);
    }
  }
  return newWordsArr;
}

function stopDictado() {
  const wasActive = dictadoActive;
  dictadoActive = false;
  dictadoSessionId++;
  if (dictadoRecognition) {
    try { dictadoRecognition.stop(); } catch(e) {}
    dictadoRecognition = null;
  }
  document.getElementById('mic-btn').classList.remove('active');
  document.getElementById('wave-bars').classList.remove('active');
  document.getElementById('mic-status').textContent = 'Tap to speak';
  stopDictadoTimer();
  setDurationChipsDisabled(false);

  if (wasActive) finishDictadoSession();
}

async function finishDictadoSession() {
  const text = finalText.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const minutes = dictadoElapsedMs / 60000;
  const wpm = minutes > 0.05 ? Math.round(words / minutes) : 0;

  if (words === 0) return; // nothing spoken, skip summary

  const ideal = 130;
  const diff = Math.abs(wpm - ideal);
  const fluency = wpm > 0 ? Math.max(30, Math.min(100, Math.round(100 - diff * 0.5))) : 0;

  document.getElementById('dictado-summary').classList.remove('hidden');
  document.getElementById('sum-words').textContent = words;
  document.getElementById('sum-wpm').textContent = wpm;
  document.getElementById('sum-fluency').textContent = fluency + '%';

  const banner = document.getElementById('record-banner');
  const prevBest = state.stats.bestWPM || 0;
  if (prevBest > 0 && wpm > prevBest) {
    document.getElementById('record-banner-text').textContent = `New Record! WPM: ${wpm}`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
  if (wpm > prevBest) state.stats.bestWPM = wpm;
  if (fluency > (state.stats.bestFluency || 0)) state.stats.bestFluency = fluency;

  state.stats.wordsTotal = (state.stats.wordsTotal || 0) + words;
  state.stats.sessions = (state.stats.sessions || 0) + 1;
  await idbPut('stats', { id: 'main', ...state.stats });
  renderRecordBadge();
  renderDesktopStats();
  await addXP(10);
}

function createDictadoRecognition(sessionId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let sessionCommitted = '';

  rec.onresult = e => {
    if (sessionId !== dictadoSessionId || !dictadoActive) return;

    let interim = '';
    let sessionFinalNow = '';
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) sessionFinalNow += transcript + ' ';
      else interim += transcript;
    }
    sessionFinalNow = sessionFinalNow.trim();

    if (sessionFinalNow && sessionFinalNow !== sessionCommitted) {
      let newPortion;
      if (sessionCommitted && sessionFinalNow.toLowerCase().startsWith(sessionCommitted.toLowerCase())) {
        newPortion = sessionFinalNow.slice(sessionCommitted.length).trim();
      } else {
        newPortion = sessionFinalNow;
      }

      if (newPortion) {
        const newWords = newPortion.split(/\s+/).filter(Boolean);
        const trimmedWords = stripDictadoOverlap(finalText, newWords);
        const trimmed = trimmedWords.join(' ').trim();
        if (trimmed) {
          finalText += (finalText && !finalText.endsWith(' ') ? ' ' : '') + trimmed + ' ';
          document.getElementById('transcript-final').textContent = finalText;
          updateSuggestions(finalText);
        }
      }
      sessionCommitted = sessionFinalNow;
    }
    document.getElementById('transcript-interim').textContent = interim;
  };

  rec.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Error: ' + e.error, 'error');
  };

  rec.onend = () => {
    if (dictadoActive && sessionId === dictadoSessionId) {
      dictadoSessionId++;
      const newSession = dictadoSessionId;
      dictadoRecognition = createDictadoRecognition(newSession);
      try { dictadoRecognition.start(); } catch(e) { stopDictado(); }
    }
  };

  return rec;
}

function toggleDictado() {
  if (dictadoActive) {
    stopDictado();
    return;
  }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Speech recognition not available. Use Chrome.', 'error');
    return;
  }

  document.getElementById('dictado-summary').classList.add('hidden');
  resetDictadoTimer();
  startDictadoTimer();
  setDurationChipsDisabled(true);

  dictadoSessionId++;
  const sessionId = dictadoSessionId;
  dictadoRecognition = createDictadoRecognition(sessionId);
  dictadoRecognition.start();
  dictadoActive = true;
  document.getElementById('mic-btn').classList.add('active');
  document.getElementById('wave-bars').classList.add('active');
  document.getElementById('mic-status').textContent = 'Listening... (tap to stop)';
}

function updateSuggestions(text) {
  const chips = document.getElementById('sugg-chips');
  chips.innerHTML = '';
  const lower = text.toLowerCase().trim();
  let suggestions = [];

  for (const [key, vals] of Object.entries(AC)) {
    if (lower.endsWith(key) || lower.includes(key)) {
      suggestions = [...suggestions, ...vals];
    }
  }

  const shown = suggestions.slice(0, 6);
  shown.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      finalText += s + ' ';
      document.getElementById('transcript-final').textContent = finalText;
    });
    chips.appendChild(chip);
  });
}

function refreshPromptPhrase() {
  const phrase = PHRASE_BANK[Math.floor(Math.random() * PHRASE_BANK.length)];
  document.getElementById('prompt-phrase').textContent = phrase;
  state.dictado.currentPhrase = phrase;
}

async function saveDictadoAsCard() {
  const text = finalText.trim();
  if (!text) { toast('No text to save', 'error'); return; }
  const id = await idbPut('phrases', { text, title: text.slice(0, 40) + '...', trans: '', created: Date.now() });
  state.phrases.push({ id, text, title: text.slice(0,40) + '...', trans: '', created: Date.now() });
  const mazoId = 'general';
  const phraseIds = state.mazos[mazoId] || [];
  phraseIds.push(id);
  state.mazos[mazoId] = phraseIds;
  await idbPut('mazos', { id: mazoId, phraseIds });
  await addXP(5);
  toast('Saved as card', 'success');
}

// ============ DURATION CHIPS (15s / 30s / 60s / Free) ============
function setDurationChipsDisabled(disabled) {
  document.querySelectorAll('.dur-chip').forEach(btn => { btn.disabled = disabled; });
}

function selectDuration(dur) {
  state.dictado.duration = dur;
  document.querySelectorAll('.dur-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dur === String(dur));
  });
  resetDictadoTimer();
}

// ============ CREATE CARD (FAB) ============
function openTarjetaModal() {
  const text = finalText.trim();
  document.getElementById('tarjeta-text-input').value = text || '';
}

function closeTarjetaModal() {
  document.getElementById('tarjeta-modal').classList.add('hidden');
}

async function createTarjeta() {
  const text = document.getElementById('tarjeta-text-input').value.trim();
  if (!text) { toast('Write a phrase for the card', 'error'); return; }

  const id = await idbPut('phrases', { text, title: text.slice(0, 40) + (text.length > 40 ? '...' : ''), trans: '', created: Date.now() });
  state.phrases.push({ id, text, title: text.slice(0,40) + (text.length > 40 ? '...' : ''), trans: '', created: Date.now() });

  const mazoId = 'general';
  const phraseIds = state.mazos[mazoId] || [];
  phraseIds.push(id);
  state.mazos[mazoId] = phraseIds;
  await idbPut('mazos', { id: mazoId, phraseIds });

  await addXP(10);
  toast('Card created', 'success');
  closeTarjetaModal();

  if (state.currentModule === 'pronun') populatePronunSelect();
}

// ============ AI TUTOR (Gemini Live) ============
function aiPanelEls() {
  return {
    panel: document.getElementById('ai-panel'),
    viewSelect: document.getElementById('ai-view-select'),
    viewKey: document.getElementById('ai-view-key'),
    viewChat: document.getElementById('ai-view-chat'),
    statusDot: document.getElementById('ai-status-dot'),
    statusText: document.getElementById('ai-status-text'),
    messages: document.getElementById('ai-messages'),
    micBtn: document.getElementById('ai-mic-btn'),
  };
}

function openAIPanel() {
  const { panel } = aiPanelEls();
  panel.classList.remove('hidden');
  renderAIView();
}

function closeAIPanel() {
  const { panel } = aiPanelEls();
  panel.classList.add('hidden');
  endAISession();
}

function renderAIView() {
  const { viewSelect, viewKey, viewChat, messages } = aiPanelEls();
  viewSelect.classList.add('hidden');
  viewKey.classList.add('hidden');
  viewChat.classList.add('hidden');

  if (!state.cfg.aiProvider) {
    viewSelect.classList.remove('hidden');
  } else if (state.cfg.aiProvider === 'own' && !state.cfg.geminiApiKey) {
    viewKey.classList.remove('hidden');
  } else {
    viewChat.classList.remove('hidden');
    if (!messages.children.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-empty-state';
      empty.id = 'ai-empty-state';
      empty.innerHTML = '<span class="msi">graphic_eq</span>Tap the mic and start speaking English.';
      messages.appendChild(empty);
    }
  }
}

async function chooseAIProvider(provider) {
  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  renderAIView();
}

async function saveAIKeyFromPanel() {
  const input = document.getElementById('ai-key-input');
  const key = input.value.trim();
  if (!key) { toast('Paste a valid API key', 'error'); return; }
  state.cfg.geminiApiKey = key;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('API key saved', 'success');
  renderAIView();
}

function setAIStatus(status) {
  state.ai.status = status;
  const { statusDot, statusText } = aiPanelEls();
  const labels = {
    idle: 'Idle', connecting: 'Connecting…', ready: 'Ready',
    listening: 'Listening…', speaking: 'Speaking…',
  };
  statusDot.className = 'ai-status-dot ' + (status === 'idle' ? '' : status);
  statusText.textContent = labels[status] || status;
}

function clearAIEmptyState() {
  const empty = document.getElementById('ai-empty-state');
  if (empty) empty.remove();
}

function appendAIText(role, text, finished) {
  if (!text) return;
  clearAIEmptyState();
  const { messages } = aiPanelEls();
  const key = role === 'user' ? 'currentUserBubble' : 'currentModelBubble';

  if (!state.ai[key]) {
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ' + role;
    bubble.textContent = '';
    messages.appendChild(bubble);
    state.ai[key] = bubble;
  }
  state.ai[key].textContent += text;
  messages.scrollTop = messages.scrollHeight;

  if (finished) state.ai[key] = null;
}

async function startAISession() {
  if (state.ai.sessionActive) return;

  const mode = state.cfg.aiProvider;
  if (!mode) { toast('Choose an AI Tutor first', 'error'); return; }
  if (mode === 'own' && !state.cfg.geminiApiKey) { toast('Add your API key first', 'error'); return; }

  const client = new GeminiLiveClient({
    mode,
    apiKey: state.cfg.geminiApiKey,
    systemInstruction: AI_TUTOR_SYSTEM_INSTRUCTION,
    onStatus: setAIStatus,
    onUserText: (text, finished) => appendAIText('user', text, finished),
    onModelText: (text, finished) => appendAIText('model', text, finished),
    onError: (err) => {
      toast(err.message || 'AI Tutor connection error', 'error');
      endAISession();
    },
    onClose: () => {
      if (state.ai.sessionActive) endAISession();
    },
  });

  state.ai.client = client;
  state.ai.sessionActive = true;

  const { micBtn } = aiPanelEls();
  micBtn.classList.add('active');

  try {
    await client.connect();
    await client.startMic();
  } catch (err) {
    toast(err.message || 'Could not start the AI Tutor session', 'error');
    endAISession();
  }
}

function endAISession() {
  const { micBtn } = aiPanelEls();
  if (micBtn) micBtn.classList.remove('active');
  if (state.ai.client) {
    state.ai.client.disconnect();
    state.ai.client = null;
  }
  state.ai.sessionActive = false;
  state.ai.currentUserBubble = null;
  state.ai.currentModelBubble = null;
  setAIStatus('idle');
}

function toggleAIMic() {
  if (state.ai.sessionActive) endAISession();
  else startAISession();
}

// ---- Settings screen: AI Tutor section ----
function renderAISettingsSection() {
  const radioOwn = document.getElementById('ai-radio-own');
  const radioDev = document.getElementById('ai-radio-developer');
  const keyRow = document.getElementById('ai-settings-key-row');
  const keyInput = document.getElementById('ai-settings-key-input');
  if (!radioOwn) return;

  radioOwn.checked = state.cfg.aiProvider === 'own';
  radioDev.checked = state.cfg.aiProvider === 'developer';
  keyInput.value = state.cfg.geminiApiKey || '';
  keyRow.classList.toggle('hidden', state.cfg.aiProvider !== 'own');
}

async function saveAISettings() {
  const provider = document.getElementById('ai-radio-own').checked ? 'own'
    : document.getElementById('ai-radio-developer').checked ? 'developer' : null;

  if (!provider) { toast('Choose an AI Tutor option', 'error'); return; }

  if (provider === 'own') {
    const key = document.getElementById('ai-settings-key-input').value.trim();
    if (!key) { toast('Add your Gemini API key', 'error'); return; }
    state.cfg.geminiApiKey = key;
  }

  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('AI Tutor settings saved', 'success');
  renderAISettingsSection();
}

// ============ SERVICE WORKER ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error:', err));
}

// ============ EVENT LISTENERS ============
document.getElementById('ai-btn').addEventListener('click', openAIPanel);
document.getElementById('ai-panel-close').addEventListener('click', closeAIPanel);
document.getElementById('ai-choose-own').addEventListener('click', () => chooseAIProvider('own'));
document.getElementById('ai-choose-developer').addEventListener('click', () => chooseAIProvider('developer'));
document.getElementById('ai-key-save').addEventListener('click', saveAIKeyFromPanel);
document.getElementById('ai-key-toggle').addEventListener('click', () => {
  const input = document.getElementById('ai-key-input');
  const icon = document.querySelector('#ai-key-toggle .msi');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-mic-btn').addEventListener('click', toggleAIMic);
document.getElementById('ai-end-btn').addEventListener('click', endAISession);

document.getElementById('ai-settings-key-toggle').addEventListener('click', () => {
  const input = document.getElementById('ai-settings-key-input');
  const icon = document.querySelector('#ai-settings-key-toggle .msi');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-radio-own').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-radio-developer').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-settings-save-btn').addEventListener('click', saveAISettings);

document.getElementById('profile-btn').addEventListener('click', () => goToScreen('profile'));
document.getElementById('topbar-back-btn').addEventListener('click', () => goToScreen('home'));
document.getElementById('profile-save-btn').addEventListener('click', saveProfileSettings);

// Mode switcher (Dictation / Pronunciation)
document.getElementById('mode-switcher-btn').addEventListener('click', e => {
  e.stopPropagation();
  toggleModeDropdown();
});
document.querySelectorAll('.mode-dropdown-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchModule(btn.dataset.module);
    toggleModeDropdown(false);
  });
});
document.addEventListener('click', e => {
  const wrap = document.getElementById('mode-switcher-wrap');
  if (wrap && !wrap.contains(e.target)) toggleModeDropdown(false);
});

// Duration chips
document.querySelectorAll('.dur-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    if (dictadoActive) return;
    selectDuration(btn.dataset.dur === 'free' ? 'free' : Number(btn.dataset.dur));
  });
});

// Pronunciation
document.getElementById('pronun-phrase-select').addEventListener('change', e => {
  if (e.target.value) loadPronunPhrase(parseInt(e.target.value));
});
document.getElementById('pronun-show-btn').addEventListener('click', () => {
  const textEl = document.getElementById('recog-text-display');
  pronunTextVisible = !pronunTextVisible;
  textEl.classList.toggle('blurred', !pronunTextVisible);
  setPronunShowBtnLabel(pronunTextVisible);
});

// Dictado
document.getElementById('mic-btn').addEventListener('click', toggleDictado);
document.getElementById('btn-delete-last').addEventListener('click', () => {
  finalText = finalText.trimEnd().split(' ').slice(0, -1).join(' ') + (finalText.trim() ? ' ' : '');
  document.getElementById('transcript-final').textContent = finalText;
});
document.getElementById('btn-clear').addEventListener('click', () => {
  finalText = '';
  document.getElementById('transcript-final').textContent = '';
  document.getElementById('transcript-interim').textContent = '';
  document.getElementById('sugg-chips').innerHTML = '';
  document.getElementById('dictado-summary').classList.add('hidden');
  resetDictadoTimer();
});
document.getElementById('btn-save-dictado').addEventListener('click', saveDictadoAsCard);
document.getElementById('prompt-refresh').addEventListener('click', refreshPromptPhrase);

// FAB create card
document.getElementById('fab-create-mazo').addEventListener('click', () => {
  openTarjetaModal();
  document.getElementById('tarjeta-modal').classList.remove('hidden');
});
document.getElementById('tarjeta-modal-close').addEventListener('click', closeTarjetaModal);
document.getElementById('tarjeta-cancel-btn').addEventListener('click', closeTarjetaModal);
document.getElementById('tarjeta-create-btn').addEventListener('click', createTarjeta);
document.getElementById('tarjeta-use-dictado-btn').addEventListener('click', () => {
  document.getElementById('tarjeta-text-input').value = finalText.trim();
});
document.getElementById('tarjeta-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('tarjeta-modal')) closeTarjetaModal();
});

// Keyboard shortcuts for dictado
document.addEventListener('keydown', e => {
  if (state.currentScreen !== 'home' || state.currentModule !== 'dictado') return;
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); toggleDictado(); }
  if (e.code === 'Backspace') {
    e.preventDefault();
    finalText = finalText.trimEnd().split(' ').slice(0, -1).join(' ') + ' ';
    document.getElementById('transcript-final').textContent = finalText;
  }
  if (e.ctrlKey && e.code === 'KeyL') {
    e.preventDefault();
    finalText = '';
    document.getElementById('transcript-final').textContent = '';
    document.getElementById('transcript-interim').textContent = '';
  }
});

// ============ ICON GENERATION (SVG → Canvas → PNG) ============
function generateIcons() {
  const sizes = [192, 512];
  sizes.forEach(size => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#121316';
    ctx.beginPath();
    const r = size * 0.18;
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e5897a';
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e5897a';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    canvas.toBlob(blob => {
      // reserved for future SW pre-caching of generated icons
    });
  });
}

// ============ INIT ============
async function init() {
  await openDB();
  await loadData();
  switchModule('dictado');
  selectDuration('free');
  goToScreen('home');
  refreshPromptPhrase();
  generateIcons();

  document.getElementById('sugg-chips').innerHTML = '';
  Object.values(AC).slice(0, 2).flat().slice(0, 5).forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      finalText += s + ' ';
      document.getElementById('transcript-final').textContent = finalText;
    });
    document.getElementById('sugg-chips').appendChild(chip);
  });
}

init().catch(console.error);
