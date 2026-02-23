const { core, mpv, menu, input, preferences, sidebar, event, console } = iina;

const PluginEvent = {
  INIT: 'jump-to-frame-init',
  UPDATE: 'jump-to-frame-update',

  VISIBILITY: 'jump-to-frame-visible',
  JUMP: 'jump-to-frame-jump'
}

const hooks = { file: null, pause: null, pos: null, posTimeout: null }
const states = { sidebarVisible: false, fps: 0 }

function registerMenuItem() {
  const keybind = preferences.get("keybind");
  const options = {};
  let hasConflict = false;

  if (keybind) {
    const kc = input.normalizeKeyCode(keybind);
    hasConflict = !!input.getAllKeyBindings()[kc];
    if (!hasConflict) options.keyBinding = keybind;
  }

  preferences.set("bindConflict", hasConflict);
  preferences.sync();

  menu.addItem(
      menu.item("Jump...", () => states.sidebarVisible ? sidebar.hide() : sidebar.show(), options)
  );
}

function updateFPS() {
  states.fps = Number(mpv.getString("current-tracks/video/demux-fps")) || 0;
  if (states.fps <= 0)
    states.fps = Number(mpv.getString("container-fps")) || 0;
}

function updateFrameData() {
  sidebar.postMessage(PluginEvent.UPDATE, {
    fps: states.fps,
    frame: mpv.getString("estimated-frame-number"),
    time: mpv.getString("time-pos/full"),
    paused: core.status.paused,
  });
}

function fileLoaded() {
  updateFPS();
  updateFrameData();
}

function pauseChanged(paused) {
  updateFrameData();

  clearTimeout(hooks.posTimeout);

  if (paused) {
    hooks.pos ??= event.on("mpv.time-pos.changed", updateFrameData);
  } else if (hooks.pos) {
    hooks.posTimeout = setTimeout(() => {
      event.off("mpv.time-pos.changed", hooks.pos);
      hooks.pos = null;
    }, 100);
  }
}

function stopUpdating() {
  if (hooks.pause) {
    event.off("mpv.pause.changed", hooks.pause);
    hooks.pause = null;
  }

  if (hooks.file) {
    event.off("iina.file-loaded", hooks.file);
    hooks.file = null;
  }

  clearTimeout(hooks.posTimeout);
  if (hooks.pos) {
    event.off("mpv.time-pos.changed", hooks.pos);
    hooks.pos = null;
  }
}

function startUpdating() {
  updateFPS();
  pauseChanged(core.status.paused)

  hooks.pause ??= event.on("mpv.pause.changed", pauseChanged);
  hooks.file ??= event.on("iina.file-loaded", fileLoaded);
}

event.on("iina.window-loaded", () => {

  sidebar.loadFile("src/sidebar.html");

  sidebar.onMessage(PluginEvent.VISIBILITY, visible => {
    states.sidebarVisible = visible;
    if (!visible) return stopUpdating();

    startUpdating();

    const countString = mpv.getString("estimated-frame-count");
    sidebar.postMessage(PluginEvent.INIT, {
      fps: states.fps,
      count: parseInt(countString, 10) || 0,
      frame: mpv.getString("estimated-frame-number"),
      time: mpv.getString("time-pos/full")
    });
  });

  sidebar.onMessage(PluginEvent.JUMP, (time) => {
    mpv.command("seek", [time, "absolute+exact"]);
  });

  registerMenuItem();

  console.log("Jump to Frame plugin loaded");
});