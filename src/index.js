const { core, mpv, menu, input, preferences, sidebar, event, console } = iina;

let sidebarVisible = false;
let fps = 0;
let fpsHook = null;
let pauseHook = null;
let posHook = null;
let posUnhookTimeout = null;

function updateFPS() {
  fps = Number(mpv.getString("current-tracks/video/demux-fps"));
  if (fps == null || fps < 1) {
    fps = Number(mpv.getString("container-fps"));
  }
  fps = parseFloat(fps) || 0;
}

function updateFrameData() {
  sidebar.postMessage("update-jump-to-frame", {
    fps: fps,
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

  clearTimeout(posUnhookTimeout);
  posUnhookTimeout = null;

  if (paused) {
    if (!posHook) {
      posHook = event.on("mpv.time-pos.changed", updateFrameData);
    }
  } else if (posHook) {
    posUnhookTimeout = setTimeout(() => {
      event.off("mpv.time-pos.changed", posHook);
      posHook = null;
    }, 100);
  }
}

function startUpdating() {
  updateFPS();
  pauseChanged(core.status.paused)

  if (!pauseHook) {
    pauseHook = event.on("mpv.pause.changed", pauseChanged);
  }

  if (!fpsHook) {
    fpsHook = event.on("iina.file-loaded", fileLoaded);
  }
}

function stopUpdating() {
  if (pauseHook) {
    event.off("mpv.pause.changed", pauseHook);
    pauseHook = null;
  }

  if (posHook) {
    event.off("mpv.time-pos.changed", posHook);
    posHook = null;
  }

  if (fpsHook) {
    event.off("iina.file-loaded", fpsHook);
    fpsHook = null;
  }
}

event.on("iina.window-loaded", () => {

  sidebar.loadFile("src/sidebar.html");

  sidebar.onMessage("visible-jump-to-frame", () => {
    sidebarVisible = true;
    startUpdating();

    const countString = mpv.getString("estimated-frame-count");
    sidebar.postMessage("init-jump-to-frame", {
      fps: fps,
      count: parseInt(countString, 10) || 0,
      frame: mpv.getString("estimated-frame-number"),
      time: mpv.getString("time-pos/full")
    });
  });

  sidebar.onMessage("hidden-jump-to-frame", () => {
    sidebarVisible = false;
    stopUpdating();
  });

  sidebar.onMessage("jump-jump-to-frame", (time) => {
    mpv.command("seek", [time, "absolute+exact"]);
  });

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
    menu.item("Jump...", () => sidebarVisible ? sidebar.hide() : sidebar.show(), options)
  );

  console.log("Jump to Frame plugin loaded");
});