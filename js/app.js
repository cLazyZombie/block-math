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
let inputLocked = false;
let ghost = null;
let touchDigit = null;
let touchStart = null;

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

function placedDigitSpeech(digit, slotIndex, slotCount) {
  if (digit === '0') return digitSpeech[digit];

  const place = slotCount - slotIndex - 1;
  if (place === 2) return digit === '1' ? '백' : `${digitSpeech[digit]}백`;
  if (place === 1) return digit === '1' ? '십' : `${digitSpeech[digit]}십`;
  return digitSpeech[digit];
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

function makeUnit(color) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.style.setProperty('--block-color', color);
  return unit;
}

function bodyColumns(count) {
  return Math.ceil(count / 10);
}

function cellColorFor(index, count) {
  if (count === 100) return index % 2 === 0 ? '#fffdf8' : digitColors[1].soft;
  if (count < 10) {
    const palette = digitColors[count];
    return palette.rainbow ? rainbowColors[index % rainbowColors.length] : palette.color;
  }

  const tens = Math.floor(count / 10);
  const ones = count % 10;
  if (ones > 0 && index >= count - ones) {
    const palette = digitColors[ones];
    return palette.rainbow ? rainbowColors[(index - (count - ones)) % rainbowColors.length] : palette.color;
  }
  return tens === 1 ? '#fffdf8' : digitColors[tens].soft;
}

function cellLineFor(index, count) {
  if (count === 100) return digitColors[1].border;
  if (count < 10) return digitColors[count].border;

  const tens = Math.floor(count / 10);
  const ones = count % 10;
  if (ones > 0 && index >= count - ones) return digitColors[ones].border;
  return digitColors[tens].border;
}

function cellPosition(index, rows) {
  const col = Math.floor(index / 10);
  const rowFromBottom = index % 10;
  return { col, row: rows - rowFromBottom };
}

function addBodyCorners(unit, col, row, occupied) {
  const has = (x, y) => occupied.has(`${x},${y}`);
  const above = has(col, row - 1);
  const below = has(col, row + 1);
  const left = has(col - 1, row);
  const right = has(col + 1, row);
  if (!above && !left) unit.classList.add('corner-tl');
  if (!above && !right) unit.classList.add('corner-tr');
  if (!below && !left) unit.classList.add('corner-bl');
  if (!below && !right) unit.classList.add('corner-br');
}

function renderNumberBody(count) {
  const cols = bodyColumns(count);
  const rows = Math.min(10, count);
  const faceCols = count >= 10 ? Math.floor(count / 10) : 1;
  const edgeDigit = count === 100 ? 1 : (count % 10 || Math.floor(count / 10) || count);
  const occupied = new Set();
  const body = document.createElement('div');
  body.className = 'number-body';
  body.style.setProperty('--body-cols', String(cols));
  body.style.setProperty('--body-rows', String(rows));
  body.style.setProperty('--face-cols', String(faceCols));
  body.style.setProperty('--body-border', digitColors[edgeDigit].border);

  for (let i = 0; i < count; i += 1) {
    const { col, row } = cellPosition(i, rows);
    occupied.add(`${col},${row}`);
  }

  for (let i = 0; i < count; i += 1) {
    const unit = makeUnit(cellColorFor(i, count));
    const { col, row } = cellPosition(i, rows);
    unit.classList.add('body-unit');
    unit.style.setProperty('--cell-line', cellLineFor(i, count));
    unit.style.gridColumn = String(col + 1);
    unit.style.gridRow = String(row);
    addBodyCorners(unit, col, row, occupied);
    body.appendChild(unit);
  }

  const face = document.createElement('div');
  face.className = 'body-face';
  face.innerHTML = '<span class="face-eye"></span><span class="face-eye"></span><span class="face-mouth"></span>';
  body.appendChild(face);
  return body;
}

function renderBlocks(n) {
  stage.innerHTML = '';
  stage.classList.toggle('tall', n >= 10);
  stage.classList.toggle('many', n >= 50);
  stage.appendChild(renderNumberBody(n));
}

function renderSlots() {
  filledDigits = Array.from(String(currentNumber), () => '');
  slots.innerHTML = '';
  const expectedDigits = Array.from(String(currentNumber));
  filledDigits.forEach((_, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    slot.dataset.index = String(index);
    slot.dataset.digit = expectedDigits[index];
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
    button.dataset.digit = digit;
    button.id = `digit-${digit}`;
    button.draggable = true;
    button.style.setProperty('--key-color', palette.color);
    button.style.setProperty('--key-shadow', palette.shadow);
    attachDigitEvents(button);
    keypad.appendChild(button);
  });
}

function attachDigitEvents(button) {
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', button.dataset.digit);
    event.dataTransfer.effectAllowed = 'copy';
    button.classList.add('dragging');
  });
  button.addEventListener('dragend', () => button.classList.remove('dragging', 'shake'));
  button.addEventListener('touchstart', (event) => onTouchStart(event, button), { passive: false });
}

function setupSlotDropZone() {
  slots.addEventListener('dragover', (event) => {
    const slot = event.target.closest('.slot');
    if (!slot || slot.classList.contains('filled') || inputLocked) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    slot.classList.add('hover');
  });

  slots.addEventListener('dragleave', (event) => {
    const slot = event.target.closest('.slot');
    if (slot) slot.classList.remove('hover');
  });

  slots.addEventListener('drop', (event) => {
    event.preventDefault();
    const slot = event.target.closest('.slot');
    if (!slot) return;
    slot.classList.remove('hover');
    const digit = event.dataTransfer.getData('text/plain');
    const tile = document.querySelector(`.digit-btn[data-digit="${CSS.escape(digit)}"]`);
    judgeDrop(digit, slot, tile);
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
  if (inputLocked) return;
  if (!filledDigits[index]) return;
  filledDigits = filledDigits.map((digit, i) => (i >= index ? '' : digit));
  updateSlots();
}

function judgeDrop(digit, slot, tile) {
  if (inputLocked || !digit || !slot || slot.classList.contains('filled')) return;
  const index = Number(slot.dataset.index);
  if (digit !== slot.dataset.digit) {
    flashWrong(tile, slot);
    speak('다시 해볼까?');
    return;
  }

  filledDigits[index] = digit;
  updateSlots();
  speak(placedDigitSpeech(digit, index, filledDigits.length));
  if (filledDigits.every(Boolean)) {
    inputLocked = true;
    setTimeout(completeQuestion, 1000);
  }
}

function flashWrong(tile, slot) {
  tile?.classList.add('shake');
  slot.classList.add('wrong-flash');
  setTimeout(() => {
    tile?.classList.remove('shake');
    slot.classList.remove('wrong-flash');
  }, 520);
}

function startQuestion(number = pickNumber()) {
  currentNumber = number;
  inputLocked = false;
  cleanupDrag();
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

function cleanupDrag() {
  document.querySelectorAll('.digit-ghost').forEach((el) => el.remove());
  document.querySelectorAll('.slot.hover').forEach((el) => el.classList.remove('hover'));
  document.querySelectorAll('.digit-btn.dragging').forEach((el) => el.classList.remove('dragging'));
  ghost = null;
  touchDigit = null;
  touchStart = null;
}

function onTouchStart(event, tile) {
  if (inputLocked || touchDigit) return;
  event.preventDefault();
  const touch = event.touches[0];
  touchDigit = tile;
  touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
  ghost = tile.cloneNode(true);
  const tileRect = tile.getBoundingClientRect();
  ghost.style.width = `${tileRect.width}px`;
  ghost.style.height = `${tileRect.height}px`;
  ghost.classList.add('digit-ghost');
  ghost.removeAttribute('id');
  document.body.appendChild(ghost);
  tile.classList.add('dragging');
  moveGhost(touch);

  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);
}

function moveGhost(touch) {
  if (!ghost) return;
  ghost.style.left = `${touch.clientX}px`;
  ghost.style.top = `${touch.clientY}px`;
}

function trackedTouch(list) {
  if (!touchStart) return null;
  return Array.from(list).find((touch) => touch.identifier === touchStart.id) || null;
}

function slotUnderPoint(touch) {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return el ? el.closest('.slot') : null;
}

function onTouchMove(event) {
  event.preventDefault();
  const touch = trackedTouch(event.touches);
  if (!touch) return;
  moveGhost(touch);
  document.querySelectorAll('.slot.hover').forEach((slot) => slot.classList.remove('hover'));
  const slot = slotUnderPoint(touch);
  if (slot && !slot.classList.contains('filled')) slot.classList.add('hover');
}

function onTouchEnd(event) {
  const touch = trackedTouch(event.changedTouches);
  if (!touch) return;

  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  document.removeEventListener('touchcancel', onTouchEnd);

  const slot = slotUnderPoint(touch);
  document.querySelectorAll('.slot.hover').forEach((el) => el.classList.remove('hover'));

  if (ghost) {
    ghost.remove();
    ghost = null;
  }
  if (touchDigit) {
    touchDigit.classList.remove('dragging');
    if (slot) {
      judgeDrop(touchDigit.dataset.digit, slot, touchDigit);
    }
    touchDigit = null;
    touchStart = null;
  }
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
  setupSlotDropZone();
  window.addEventListener('resize', resizeConfetti);

  window.__BLOCK_MATH__ = {
    startQuestion,
    numberToKorean,
    getCurrentNumber: () => currentNumber,
    fill: (digits) => {
      Array.from(String(digits)).forEach((digit, index) => {
        const slot = slots.children[index];
        if (slot) judgeDrop(digit, slot, document.querySelector(`.digit-btn[data-digit="${CSS.escape(digit)}"]`));
      });
    },
  };
}

init();
