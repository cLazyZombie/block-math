'use strict';

const MIN_NUMBER = 1;
const MAX_NUMBER = 100;
const AUDIO_MAP_URL = 'audio/audio-map.json';

const digitSpeech = {
  '0': '영',
  '1': '일',
  '2': '이',
  '3': '삼',
  '4': '사',
  '5': '오',
  '6': '육',
  '7': '칠',
  '8': '팔',
  '9': '구',
};

const digitColors = {
  0: { color: '#ffffff', shadow: '#d9ccc1', soft: '#fff8ef', border: '#f94f59' },
  1: { color: '#f94f59', shadow: '#d43f49', soft: '#ffd9d9', border: '#f94f59' },
  2: { color: '#ff9d32', shadow: '#d7781f', soft: '#ffe3be', border: '#ff9d32' },
  3: { color: '#ffe13d', shadow: '#d3b72f', soft: '#fff4a7', border: '#ffe13d' },
  4: { color: '#5fce67', shadow: '#43a84b', soft: '#d9f6ce', border: '#5fce67' },
  5: { color: '#42bde8', shadow: '#2a94bd', soft: '#d6f4ff', border: '#42bde8' },
  6: { color: '#6863d9', shadow: '#4b47ad', soft: '#dedcff', border: '#6863d9' },
  7: { color: '#9252d8', shadow: '#6f38b3', soft: '#ead8ff', border: '#9252d8', rainbow: true },
  8: { color: '#f15ab8', shadow: '#c63f92', soft: '#ffd7f0', border: '#f15ab8' },
  9: { color: '#9aa3b1', shadow: '#7b8490', soft: '#e3e7ee', border: '#9aa3b1' },
};

const rainbowColors = ['#f94f59', '#ff9d32', '#ffe13d', '#5fce67', '#42bde8', '#6863d9', '#9252d8'];
const confettiColors = ['#f94f59', '#ff9d32', '#ffe13d', '#5fce67', '#42bde8', '#9252d8', '#f15ab8'];

let audioByText = new Map();
let koVoice = null;
let currentAudio = null;
let currentNumber = 0;
let lastNumber = 0;
let filledDigits = [];

const stage = document.getElementById('block-stage');
const slots = document.getElementById('answer-slots');
const keypad = document.getElementById('keypad');
const praise = document.getElementById('praise');
const praiseNumber = document.getElementById('praise-number');
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRunning = false;

function numberToKorean(n) {
  if (n === 100) return '백';
  if (n < 10) return digitSpeech[String(n)];

  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const parts = [];
  if (tens === 1) {
    parts.push('십');
  } else {
    parts.push(`${digitSpeech[String(tens)]}십`);
  }
  if (ones > 0) parts.push(digitSpeech[String(ones)]);
  return parts.join(' ');
}

function pickNumber() {
  if (MAX_NUMBER === MIN_NUMBER) return MIN_NUMBER;
  let next = lastNumber;
  while (next === lastNumber) {
    next = MIN_NUMBER + Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1));
  }
  lastNumber = next;
  return next;
}

function showScene(id) {
  document.querySelectorAll('.scene').forEach((scene) => {
    scene.classList.toggle('active', scene.id === id);
  });
}

async function loadAudioMap() {
  try {
    const res = await fetch(AUDIO_MAP_URL);
    if (!res.ok) throw new Error(`audio map HTTP ${res.status}`);
    const map = await res.json();
    audioByText = new Map(Object.entries(map));
  } catch (err) {
    audioByText = new Map();
    console.warn('audio map load failed:', err);
  }
}

function pickKoreanVoice() {
  const voices = (window.speechSynthesis?.getVoices() || [])
    .filter((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith('ko'));
  const preferred = ['sunhi', '유나', 'yuna', 'sora', '소라', 'google 한국'];
  koVoice = voices.find((voice) => preferred.some((hint) => voice.name.toLowerCase().includes(hint)))
    || voices[0]
    || null;
}

function cancelSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = 0.85;
  utter.pitch = 1.08;
  if (koVoice) utter.voice = koVoice;
  window.speechSynthesis.speak(utter);
}

function speak(text) {
  cancelSpeech();
  const audioPath = audioByText.get(text);
  if (!audioPath) {
    speakWithBrowser(text);
    return;
  }

  const audio = new Audio(audioPath);
  currentAudio = audio;
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) currentAudio = null;
  }, { once: true });
  audio.addEventListener('error', () => {
    if (currentAudio === audio) currentAudio = null;
    speakWithBrowser(text);
  }, { once: true });
  audio.play().catch(() => {
    if (currentAudio === audio) currentAudio = null;
    speakWithBrowser(text);
  });
}

function makeUnit(color, index, total) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.style.setProperty('--block-color', color);
  if (index === total - 1) unit.classList.add('face');
  return unit;
}

function onesLayout(count) {
  if (count <= 3) return { cols: 1, rows: count, positions: Array.from({ length: count }, (_, i) => [0, count - 1 - i]) };
  if (count === 4) return { cols: 2, rows: 2, positions: [[0, 1], [1, 1], [0, 0], [1, 0]] };
  if (count === 5) return { cols: 2, rows: 3, positions: [[0, 2], [1, 2], [0, 1], [1, 1], [0, 0]] };
  if (count === 6) return { cols: 2, rows: 3, positions: [[0, 2], [1, 2], [0, 1], [1, 1], [0, 0], [1, 0]] };
  if (count === 7) return { cols: 2, rows: 4, positions: [[0, 3], [1, 3], [0, 2], [1, 2], [0, 1], [1, 1], [0, 0]] };
  if (count === 8) return { cols: 2, rows: 4, positions: [[0, 3], [1, 3], [0, 2], [1, 2], [0, 1], [1, 1], [0, 0], [1, 0]] };
  return { cols: 3, rows: 3, positions: [[0, 2], [1, 2], [2, 2], [0, 1], [1, 1], [2, 1], [0, 0], [1, 0], [2, 0]] };
}

function renderOnes(count, digit) {
  const layout = onesLayout(count);
  const group = document.createElement('div');
  group.className = 'ones-group';
  group.style.setProperty('--cols', String(layout.cols));
  group.style.setProperty('--rows', String(layout.rows));
  const palette = digitColors[digit];

  layout.positions.forEach(([col, row], index) => {
    const color = palette.rainbow ? rainbowColors[index % rainbowColors.length] : palette.color;
    const unit = makeUnit(color, index, count);
    unit.style.gridColumn = String(col + 1);
    unit.style.gridRow = String(row + 1);
    group.appendChild(unit);
  });
  return group;
}

function renderTenPack(tensDigit) {
  const palette = digitColors[tensDigit || 1];
  const pack = document.createElement('div');
  pack.className = 'ten-pack';
  pack.style.setProperty('--pack-bg', tensDigit === 1 ? '#fffdf8' : palette.soft);
  pack.style.setProperty('--pack-border', palette.border);
  for (let i = 0; i < 10; i += 1) {
    const mini = document.createElement('div');
    mini.className = 'mini';
    pack.appendChild(mini);
  }
  return pack;
}

function renderHundred() {
  const board = document.createElement('div');
  board.className = 'hundred-board';
  for (let i = 0; i < 100; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'hundred-cell';
    board.appendChild(cell);
  }
  return board;
}

function renderBlocks(n) {
  stage.innerHTML = '';
  stage.classList.toggle('many', n >= 50);

  if (n === 100) {
    stage.appendChild(renderHundred());
    return;
  }

  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) {
    stage.appendChild(renderOnes(n, n));
    return;
  }

  for (let i = 0; i < tens; i += 1) {
    stage.appendChild(renderTenPack(tens));
  }
  if (ones > 0) stage.appendChild(renderOnes(ones, ones));
}

function renderSlots() {
  filledDigits = Array.from(String(currentNumber), () => '');
  slots.innerHTML = '';
  filledDigits.forEach((_, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    slot.setAttribute('aria-label', `${index + 1}번째 자리`);
    slot.addEventListener('click', () => clearFrom(index));
    slots.appendChild(slot);
  });
}

function renderKeypad() {
  keypad.innerHTML = '';
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((digit) => {
    const palette = digitColors[Number(digit)];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'digit-btn';
    button.textContent = digit;
    button.style.setProperty('--key-color', palette.color);
    button.style.setProperty('--key-shadow', palette.shadow);
    button.addEventListener('click', () => pressDigit(digit));
    keypad.appendChild(button);
  });
}

function updateSlots() {
  const children = Array.from(slots.children);
  children.forEach((slot, index) => {
    const digit = filledDigits[index];
    slot.textContent = digit;
    slot.classList.toggle('filled', Boolean(digit));
    if (digit) {
      slot.style.setProperty('--slot-color', digitColors[Number(digit)].color);
    } else {
      slot.style.removeProperty('--slot-color');
    }
  });
}

function clearFrom(index) {
  if (!filledDigits[index]) return;
  filledDigits = filledDigits.map((digit, i) => (i >= index ? '' : digit));
  updateSlots();
}

function pressDigit(digit) {
  const nextIndex = filledDigits.findIndex((value) => value === '');
  if (nextIndex === -1) return;
  filledDigits[nextIndex] = digit;
  updateSlots();
  speak(digitSpeech[digit]);
  if (filledDigits.every(Boolean)) {
    setTimeout(checkAnswer, 120);
  }
}

function checkAnswer() {
  const answer = filledDigits.join('');
  if (Number(answer) === currentNumber) {
    completeQuestion();
    return;
  }
  slots.classList.add('wrong');
  speak('다시 해볼까?');
  setTimeout(() => {
    slots.classList.remove('wrong');
    filledDigits = filledDigits.map(() => '');
    updateSlots();
  }, 720);
}

function startQuestion(number = pickNumber()) {
  currentNumber = number;
  praise.classList.add('hidden');
  renderBlocks(currentNumber);
  renderSlots();
  updateSlots();
  setTimeout(() => speak('숫자를 맞혀 볼까요?'), 250);
}

function completeQuestion() {
  const spoken = numberToKorean(currentNumber);
  praiseNumber.textContent = spoken;
  praise.classList.remove('hidden');
  launchConfetti();
  setTimeout(() => speak(`참 잘했어요! ${spoken}!`), 220);
}

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function launchConfetti() {
  resizeConfetti();
  for (let i = 0; i < 140; i += 1) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.45,
      w: 8 + Math.random() * 10,
      h: 6 + Math.random() * 8,
      vx: -1.8 + Math.random() * 3.6,
      vy: 2.2 + Math.random() * 3.8,
      rot: Math.random() * Math.PI,
      vrot: -0.16 + Math.random() * 0.32,
      color: confettiColors[i % confettiColors.length],
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(tickConfetti);
  }
}

function tickConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  });
  confettiParticles = confettiParticles.filter((p) => p.y < confettiCanvas.height + 40);
  if (confettiParticles.length) {
    requestAnimationFrame(tickConfetti);
  } else {
    confettiRunning = false;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

async function init() {
  renderKeypad();
  await loadAudioMap();
  if ('speechSynthesis' in window) {
    pickKoreanVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickKoreanVoice);
  }

  document.getElementById('btn-start').addEventListener('click', () => {
    showScene('scene-game');
    startQuestion();
  });
  document.getElementById('btn-home').addEventListener('click', () => {
    cancelSpeech();
    showScene('scene-title');
  });
  document.getElementById('btn-sound').addEventListener('click', () => {
    speak(numberToKorean(currentNumber));
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    startQuestion();
  });
  window.addEventListener('resize', resizeConfetti);

  window.__BLOCK_MATH__ = {
    startQuestion,
    numberToKorean,
    getCurrentNumber: () => currentNumber,
    fill: (digits) => {
      filledDigits = String(digits).slice(0, String(currentNumber).length).split('');
      while (filledDigits.length < String(currentNumber).length) filledDigits.push('');
      updateSlots();
      if (filledDigits.every(Boolean)) checkAnswer();
    },
  };
}

init();
