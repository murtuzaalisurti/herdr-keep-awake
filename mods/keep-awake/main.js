import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { hc, exec, home, theme, agents, checking } from "herdr";

const NAME = "keep-awake";
const script = () => `${home()}\\.config\\herdr-app\\mods\\keep-awake\\awake.ps1`;
const startArgs = () => ["run", "--bg", "--no-parent", "--no-notify", "--rm", "--name", NAME, "--", "pwsh", "-NoProfile", "-File", script()];
const LNK = `(Join-Path ([Environment]::GetFolderPath('Startup')) 'herdr-keep-awake.lnk')`;

const pwsh = (cmd) => exec("pwsh", ["-NoProfile", "-Command", cmd]);

export default class KeepAwake extends View {
  init(_props, cx) {
    this.running = null;
    this.autostart = null;
    this.busy = false;
    if (checking()) return;
    this.refresh(cx);
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      const r = await hc(["get", NAME, "--json"]);
      this.running = r.code === 0 && r.stdout.includes('"live"');
      const a = await pwsh(`Test-Path ${LNK}`);
      this.autostart = a.stdout.trim() === "True";
      cx.notify();
    });
  }

  act(cx, work) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try { await work(); } catch (e) { console.log("keep-awake: " + e); }
      this.busy = false;
      this.refresh(cx);
    });
  }

  toggleRunning(cx) {
    this.act(cx, () => (this.running ? hc(["kill", NAME]) : hc(startArgs())));
  }

  toggleAutostart(cx) {
    const on = !this.autostart;
    const cmd = "hc " + startArgs().map((a) => (a.includes(" ") ? `\\"${a}\\"` : a)).join(" ");
    this.act(cx, () => pwsh(on
      ? `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${LNK}); ` +
        `$s.TargetPath = (Get-Command pwsh).Source; ` +
        `$s.Arguments = '-NoProfile -WindowStyle Hidden -Command "${cmd}"'; $s.WindowStyle = 7; $s.Save()`
      : `Remove-Item ${LNK} -ErrorAction SilentlyContinue`));
  }

  row(t, id, label, value, on, onClick) {
    return h_flex().justify_between().items_center().gap(16)
      .child(div().text_color(t.foreground).child(label))
      .child(div().id(id).px(10).py(4).rounded(4).border(1)
        .border_color(on ? t.accent : t.border)
        .bg(on ? t.accent : t.surface)
        .text_color(on ? t.accent_foreground : t.muted)
        .hover((s) => s.bg(t.hover))
        .child(value)
        .on_click((_e, cx) => onClick(cx)));
  }

  render(_cx) {
    const t = theme();
    const working = agents().some((a) => a.status === "working");
    const state = this.running === null ? "…"
      : !this.running ? "Stopped: PC sleeps normally"
      : working ? "Running: keeping PC awake (agents working)"
      : "Running: idle, PC sleeps normally";
    return v_flex().p(16).gap(12).text_size(13).bg(t.popover)
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Keep awake"))
      .child(div().text_color(this.running && working ? t.working : t.muted).child(state))
      .child(this.row(t, "toggle-run", "Keep awake while agents work",
        this.busy ? "…" : this.running ? "On" : "Off", !!this.running, (cx) => this.toggleRunning(cx)))
      .child(this.row(t, "toggle-auto", "Start at login",
        this.busy ? "…" : this.autostart ? "On" : "Off", !!this.autostart, (cx) => this.toggleAutostart(cx)));
  }
}
