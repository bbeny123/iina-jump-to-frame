const frameInput = document.getElementById('frameInput');
const timeInput = document.getElementById('timeInput');
const jumpBtn = document.getElementById('jumpBtn');
const historyContainer = document.getElementById('historyContainer');
const currentFps = document.getElementById('currentFps');
const currentFrame = document.getElementById('currentFrame');
const currentTime = document.getElementById('currentTime');
const errorMsg = document.getElementById('errorMsg');

let fps = null;
let syncing = false;
let playTimeout = null;

function sanitizeTimeInput(time) {
  time = time.replace(',', '.');
  time = time.replace(/[^0-9:.]/g, '');
  time = time.replace(/:{2,}/g, ':').replace(/\.{2,}/g, '.');

  const parts = time.split(':');
  if (parts.length > 3) {
    time = parts.slice(0, 3).join(':');
  }

  const dotParts = time.split('.');
  return dotParts.length > 1
    ? dotParts[0] + '.' + dotParts[1].split(':')[0].substring(0, 3)
    : time;
}

function parseTime(str) {
  if (!str) return 0;

  const multipliers = [1, 60, 3600];
  return str.replace(',', '.').split(':').reverse()
    .reduce((acc, val, i) => acc + (parseFloat(val) || 0) * multipliers[i], 0);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00:00.000";

  const [secTotal, ms] = Number(seconds).toFixed(3).split(".");

  const sec = parseInt(secTotal, 10);
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = sec % 60;

  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${ms}`;
}

function addHistoryItem(frame, time) {
  frame = parseInt(frame, 10) || 0;
  time = time || "00:00:00.000";

  if (historyContainer.querySelector('.empty-state')) {
    historyContainer.replaceChildren();
  }

  const existingItem = historyContainer.querySelector(`[data-frame="${frame}"]`);
  if (existingItem) {
    existingItem.remove();
  }

  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.frame = frame;
  div.dataset.time = time;

  div.innerHTML = `
        <span class="history-frame">Frame ${frame}</span>
        <span class="history-time">${time}</span>
  `;

  historyContainer.prepend(div);
  while (historyContainer.childElementCount > 10) {
    historyContainer.lastElementChild.remove();
  }
}

function recalculateHistory() {
  const items = historyContainer.querySelectorAll('.history-item');

  items.forEach(item => {
    const frame = parseInt(item.dataset.frame, 10) || 0;
    const newTime = formatTime(frame / fps);
    item.dataset.time = newTime;

    const timeSpan = item.querySelector('.history-time');
    if (timeSpan) {
      timeSpan.textContent = newTime;
    }
  });
}

function updateFPS(newFps) {
  if (fps === newFps) return;

  fps = newFps;
  if (isNaN(fps) || newFps <= 0) {
    currentFps.textContent = 'N/A';
    currentFps.classList.add('error');
    errorMsg.style.display = 'block';
    jumpBtn.disabled = true;
    frameInput.disabled = true;
    timeInput.disabled = true;
  } else {
    currentFps.textContent = Number(fps.toFixed(3));
    currentFps.classList.remove('error');
    errorMsg.style.display = 'none';
    jumpBtn.disabled = false;
    frameInput.disabled = false;
    timeInput.disabled = false;
    recalculateHistory();
  }
}

function doJump() {
  const time = sanitizeTimeInput(timeInput.value);
  const seconds = parseTime(time);

  if (isNaN(seconds) || seconds < 0) return;

  iina.postMessage('jump-jump-to-frame', time);

  addHistoryItem(frameInput.value, time);
}

frameInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');

  if (syncing) return;
  syncing = true;

  const frame = parseInt(e.target.value, 10) || 0;
  timeInput.value = formatTime(frame / fps);

  syncing = false;
});

timeInput.addEventListener('input', (e) => {
  e.target.value = sanitizeTimeInput(e.target.value);

  if (syncing) return;
  syncing = true;

  const seconds = parseTime(e.target.value);
  frameInput.value = Math.round(seconds * fps);

  syncing = false;
});

jumpBtn.addEventListener('click', doJump);

frameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJump();
});

timeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJump();
});

historyContainer.addEventListener('click', (event) => {
  const item = event.target.closest('.history-item');
  if (!item) return;

  frameInput.value = item.dataset.frame;
  timeInput.value = item.dataset.time;

  doJump();
});

iina.onMessage("update-jump-to-frame", ({ fps: newFps, frame, time, paused }) => {
  updateFPS(newFps);

  clearTimeout(playTimeout);
  playTimeout = null;

  if (paused) {
    currentFrame.textContent = frame;
    currentFrame.classList.remove('playing');
    currentTime.textContent = formatTime(time);
    currentTime.classList.remove('playing');
  } else {
    playTimeout = setTimeout(() => {
      currentFrame.textContent = '-';
      currentFrame.classList.add('playing');
      currentTime.textContent = '-';
      currentTime.classList.add('playing');
      playTimeout = null;
    }, 100);
  }

});

iina.onMessage("init-jump-to-frame", ({ frame, time }) => {
  frameInput.value = frame;
  timeInput.value = formatTime(parseFloat(time));
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    iina.postMessage("hidden-jump-to-frame");
  } else {
    iina.postMessage("visible-jump-to-frame");
  }
});