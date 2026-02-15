const { core, mpv, utils, menu } = iina;

function currentTimestamp() {
  const time = mpv.getString("time-pos/full");
  const timeNum = parseFloat(time);
  if (isNaN(timeNum) || timeNum < 0) return "";

  const [secondsPart, msPart = ""] = time.split(".");
  const seconds = parseInt(secondsPart, 10);

  const pad = (n) => n.toString().padStart(2, '0');
  const h = pad(Math.floor(seconds / 3600));
  const m = pad(Math.floor(seconds % 3600 / 60));
  const s = pad(seconds % 60);
  const ms = msPart.padEnd(3, '0').substring(0, 3);

  return `${h}:${m}:${s}.${ms}\n`;
}

function formatFps(value) {
  const str = value.toString();
  const dot = str.indexOf('.');

  if (dot === -1) return str;

  return (str[dot + 1] >= '1'
    ? str.substring(0, dot + 4)
    : str.substring(0, dot));
}

function jumpToFrame() {
  let fps = Number(mpv.getString("current-tracks/video/demux-fps"));
  if (fps == null || fps < 1) {
      fps = Number(mpv.getString("container-fps"));
  }

  if (!fps || fps < 1) {
    core.osd("Unable to retrieve FPS");
    return;
  }

  const current_frame = mpv.getString("estimated-frame-number");

  const input = utils.prompt(`${currentTimestamp()}Current frame: ${current_frame} / ${formatFps(fps)}`);
  if (!input?.trim()) return;

  const frame = parseInt(input, 10);
  if (isNaN(frame) || frame < 0) {
    core.osd("Invalid frame number");
    return;
  }

  const time = frame / fps;
  mpv.command("seek", [time.toString(), "absolute+exact"]);
}

menu.addItem(
  menu.item(
    "Jump to frame...",
    jumpToFrame,
    {
      keyBinding: "Meta+g",
    },
  ),
);
