const els = {
  currentFps: document.getElementById('currentFps'),
  currentFrame: document.getElementById('currentFrame'),
  currentTime: document.getElementById('currentTime'),

  errorMsg: document.getElementById('errorMsg'),
  frameInput: document.getElementById('frameInput'),
  timeInput: document.getElementById('timeInput'),
  jumpBtn: document.getElementById('jumpBtn'),

  history: document.getElementById('historyContainer')
}

const PluginEvent = {
  INIT: 'jump-to-frame-init',
  UPDATE: 'jump-to-frame-update',

  VISIBILITY: 'jump-to-frame-visible',
  JUMP: 'jump-to-frame-jump'
}

const states = { fps: null, playTimeout: null }

function sanitizeInput(e, sanitizeFn) {
  const input = e.target;
  const { value: inputValue, selectionStart: pos } = input;

  const clean = sanitizeFn(inputValue);

  if (inputValue !== clean) {
    const cleanPos = sanitizeFn(inputValue.slice(0, pos)).length;
    input.value = clean;
    input.setSelectionRange(cleanPos, cleanPos);
  }

  return clean;
}

function sanitizeTimeInput(time) {
  time = time.replace(',', '.').replace(/[^0-9:.]/g, '')
      .replace(/:{2,}/g, ':').replace(/\.{2,}/g, '.');

  const colonParts = time.split(':');
  if (colonParts.length > 3) {
    time = `${colonParts[0]}:${colonParts[1]}:${colonParts.slice(2).join('')}`;
  }

  const [main, ...ms] = time.split('.');
  return ms.length > 0
    ? `${main}.${ms.join('').replaceAll(':', '').slice(0, 3)}`
    : time;
}

function parseTime(str) {
  if (!str) return 0;

  const multipliers = [1, 60, 3600];
  return str.replaceAll(',', '.').split(':').reverse().slice(0, 3)
    .reduce((acc, val, i) => acc + (+val || 0) * multipliers[i], 0);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00:00.000";

  const [secTotal, ms] = Number(seconds).toFixed(3).split(".");

  const sec = parseInt(secTotal, 10);
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = sec % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${ms}`;
}

function addHistoryItem(frame, time) {
  frame = parseInt(frame, 10) || 0;
  time = time || "00:00:00.000";

  if (els.history.querySelector('.empty-state'))
    els.history.replaceChildren();

  els.history.querySelector(`[data-frame="${frame}"]`)?.remove();

  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.frame = frame;
  div.dataset.time = time;

  div.innerHTML = `
    <span class="history-frame">Frame ${frame}</span>
    <span class="history-time">${time}</span>
  `;

  els.history.prepend(div);
  while (els.history.childElementCount > 10)
    els.history.lastElementChild.remove();
}

function recalculateHistory() {
  const items = els.history.querySelectorAll('.history-item');

  items.forEach(item => {
    const frame = parseInt(item.dataset.frame, 10) || 0;
    const newTime = formatTime(frame / states.fps);
    item.dataset.time = newTime;

    const timeSpan = item.querySelector('.history-time');
    if (timeSpan) timeSpan.textContent = newTime;
  });
}

function updateFPS(newFps) {
  if (states.fps === newFps) return;
  states.fps = newFps;

  const invalid = isNaN(newFps) || newFps <= 0;

  els.currentFps.textContent = invalid ? 'N/A' : +newFps.toFixed(3);
  els.errorMsg.style.display = invalid ? 'block' : 'none';
  els.currentFps.classList.toggle('error', invalid);
  els.jumpBtn.disabled = invalid;
  els.frameInput.disabled = invalid;
  els.timeInput.disabled = invalid;

  if (!invalid) recalculateHistory();
}

function doJump() {
  const time = sanitizeTimeInput(els.timeInput.value);
  const seconds = parseTime(time);

  if (isNaN(seconds) || seconds < 0) return;

  iina.postMessage(PluginEvent.JUMP, time);

  addHistoryItem(els.frameInput.value, time);
}

els.frameInput.addEventListener('input', e => {
  const value = sanitizeInput(e, inputValue => inputValue.replace(/[^0-9]/g, ''));

  const frame = parseInt(value, 10) || 0;
  els.timeInput.value = formatTime(frame / states.fps);
});

els.timeInput.addEventListener('input', (e) => {
  const value = sanitizeInput(e, sanitizeTimeInput);

  const seconds = parseTime(value);
  els.frameInput.value = Math.round(seconds * states.fps);
});

els.jumpBtn.addEventListener('click', doJump);

els.frameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJump();
});

els.timeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJump();
});

els.history.addEventListener('click', (event) => {
  const item = event.target.closest('.history-item');
  if (!item) return;

  els.frameInput.value = item.dataset.frame;
  els.timeInput.value = item.dataset.time;

  doJump();
});

iina.onMessage(PluginEvent.UPDATE, ({ fps: newFps, frame, time, paused }) => {
  updateFPS(newFps);

  clearTimeout(states.playTimeout);
  states.playTimeout = null;

  if (paused) {
    els.currentFrame.textContent = frame;
    els.currentFrame.classList.remove('playing');
    els.currentTime.textContent = formatTime(time);
    els.currentTime.classList.remove('playing');
  } else {
    states.playTimeout = setTimeout(() => {
      els.currentFrame.textContent = '-';
      els.currentFrame.classList.add('playing');
      els.currentTime.textContent = '-';
      els.currentTime.classList.add('playing');
      states.playTimeout = null;
    }, 100);
  }

});

iina.onMessage(PluginEvent.INIT, ({ fps: newFps, count, frame, time }) => {
  updateFPS(newFps);
  els.frameInput.value = frame;
  els.timeInput.value = formatTime(parseFloat(time));

  if (states.fps <= 0 || count <= 0 || els.history.querySelector('.history-item')) return;

  Array.from({ length: 5 }, (_, i) => Math.round(count * (1 - (i / 4))))
     .forEach(f => addHistoryItem(f, formatTime(f / states.fps)));
});

document.addEventListener('visibilitychange', () => {
  iina.postMessage(PluginEvent.VISIBILITY, !document.hidden);
});