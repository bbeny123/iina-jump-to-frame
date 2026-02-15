const keybindInput = document.getElementById('keybindInput');
const validationInfo = document.getElementById('validationInfo');

const MODIFIERS = {
  meta: 'Meta',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift'
};

const SPECIAL_KEYS = new Set([
  "ENTER", "TAB", "SPACE", "ESC", "BS", "LEFT", "RIGHT", "UP", "DOWN",
  "KP_DEL", "DEL", "KP_INS", "INS", "HOME", "END", "PGUP", "PGDWN", "PRINT",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
]);

let conflictingBind = null;
let saveTimeout = null;

function normalizeKeybind(key) {
  if (!key) return '';

  const parts = key.split('+');
  let actualKey = parts.pop();
  const upperKey = actualKey.toUpperCase();
  actualKey = SPECIAL_KEYS.has(upperKey) ? upperKey : actualKey;

  if (!parts.length) return actualKey;

  const partsSet = new Set(parts.map(p => p.toLowerCase()));

  const normalizedModifiers = Object.keys(MODIFIERS)
    .filter(key => partsSet.has(key))
    .map(key => MODIFIERS[key]);

  return [...normalizedModifiers, actualKey].join('+');
}

function sanitizeInput(input) {
  input = input.replace(/^\++/, '').replace(/\+{2,}/g, '+').replace(/\s+/g, '');
  if (!input) return "";

  const parts = input.split('+');
  const danglingPart = parts.pop();

  const seen = new Set();
  const resultParts = [];
  parts.forEach(part => {
    const lowerPart = part.toLowerCase();

    if (part !== "" && !seen.has(lowerPart)) {
      seen.add(lowerPart);
      resultParts.push(part);
    }
  });

  return [...resultParts, danglingPart].join('+');
}

function validateKeybind(key) {
  if (!key) return "";
  if (key.endsWith('+')) return "Invalid format: Trailing +";

  const parts = key.split('+');
  const actualKey = parts.pop();

  if (MODIFIERS[actualKey.toLowerCase()]) return "Invalid format: Trailing modifier";

  const invalidMods = parts.filter(p => !MODIFIERS[p.toLowerCase()]);
  if (invalidMods.length > 0) return `Unknown modifier(s): ${invalidMods.join(', ')}`;

  if (actualKey.length > 1 && !SPECIAL_KEYS.has(actualKey.toUpperCase())) {
    return `Possibly invalid key: ${actualKey}`;
  }

  return "";
}

function changeValidationInfo(className, message) {
  validationInfo.textContent = message;
  validationInfo.className = `info-box ${className}`;
}

function setInput(input, userInput = true) {
  input = sanitizeInput(input);
  keybindInput.value = input;

  const msg = validateKeybind(input);
  if (!input) {
    changeValidationInfo('info', "ⓘ Keybind disabled");
  } else if (!msg) {
    changeValidationInfo('valid', '✓ Keybind is valid');
  } else if (msg.startsWith("Possibly")) {
    changeValidationInfo('warning', "⚠ " + msg);
  } else {
    changeValidationInfo('error', "⚠ " + msg);
    return;
  }

  const normalized = userInput ? normalizeKeybind(input) : input;

  if (normalized && normalized === conflictingBind) {
    changeValidationInfo('error', "⚠ Keybind is already in use");
  }

  if (!userInput) return;

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    iina.preferences.set("keybind", normalized);
    iina.preferences.set("bindConflict", false);
    saveTimeout = null;
  }, 200);
}

keybindInput.addEventListener('input', e => setInput(e.target.value));

iina.preferences.get("keybind", keybind => {
  iina.preferences.get("bindConflict", hasConflict => {
    if (hasConflict) conflictingBind = keybind;
    setInput(keybind || "", false);
  });
});