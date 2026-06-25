// ════════════════════════════════════════════════════════════════
//  Info Rail (Super+I) — sağ-anchored dikey bilgi paneli.
//  Saat/tarih · sistem · ses · hava. Tray YOK (ikinci shell değil).
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { createBinding, createComputed } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Wp from "gi://AstalWp"
import PanelWindow from "../common/PanelWindow"
import { cpuPercent, ramUsed, ramFraction, cpuTemp } from "../../lib/sysinfo"

const BAR_W = 232

function Bar({ icon, label, value, frac }: { icon: string; label: string; value: any; frac: any }) {
  return (
    <box class="ir-stat" vertical={true}>
      <box>
        <label class="ir-ic" label={icon} />
        <label class="ir-lbl" label={label} />
        <box hexpand />
        <label class="ir-val" label={value} />
      </box>
      <box class="ir-bar" widthRequest={BAR_W} halign={Gtk.Align.START}>
        <box
          class="ir-bar-fill"
          halign={Gtk.Align.START}
          widthRequest={frac((f: number) =>
            Math.max(3, Math.round(Math.max(0, Math.min(1, f)) * BAR_W)),
          )}
        />
      </box>
    </box>
  )
}

function VolumeSlider() {
  const wp = Wp.get_default()!
  const speaker = wp.audio.defaultSpeaker
  const vol = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")
  const icon = createComputed([vol, mute], (v, m) =>
    m ? "󰝟" : v < 0.34 ? "󰕿" : v < 0.67 ? "󰖀" : "󰕾",
  )
  return (
    <box class="ir-vol">
      <label class="icon" label={icon} valign={Gtk.Align.CENTER} />
      <slider
        hexpand
        value={vol}
        min={0}
        max={1}
        step={0.01}
        onDragged={(self: any) => {
          const x = self.value
          if (Number.isFinite(x)) {
            speaker.volume = Math.max(0, Math.min(1, x))
            speaker.mute = false
          }
        }}
      />
    </box>
  )
}

function InfoRail() {
  const clock = createPoll("", 1000, "date +'%H:%M'")
  const date = createPoll("", 30000, "date +'%a, %d %b'")
  const cpu = createPoll(0, 2000, () => cpuPercent())
  const ram = createPoll(ramUsed(), 2000, () => ramUsed())
  const ramF = createPoll(ramFraction(), 2000, () => ramFraction())
  const temp = createPoll(cpuTemp(), 2000, () => cpuTemp())
  const weather = createPoll("", 600000, `bash ${GLib.get_home_dir()}/.config/ags/scripts/weather.sh`)

  const card = (
    <box class="ir" vertical={true}>
      <box class="ir-head" vertical={true}>
        <label class="ir-clock" label={clock} halign={Gtk.Align.CENTER} />
        <label class="ir-date" label={date} halign={Gtk.Align.CENTER} />
      </box>

      <box class="ir-section" vertical={true}>
        <label class="ir-sec-title" label="SİSTEM" halign={Gtk.Align.START} />
        <Bar icon="󰍛" label="İşlemci" value={cpu((c) => `${c}%`)} frac={cpu((c) => c / 100)} />
        <Bar icon="󰘚" label="Bellek" value={ram} frac={ramF} />
        <box class="ir-temp">
          <label class="ir-ic" label="󰔏" />
          <label class="ir-lbl" label="Sıcaklık" />
          <box hexpand />
          <label class="ir-val" label={temp((t) => t || "—")} />
        </box>
      </box>

      <box class="ir-section" vertical={true}>
        <label class="ir-sec-title" label="SES" halign={Gtk.Align.START} />
        <VolumeSlider />
      </box>

      <box class="ir-section ir-weather" vertical={true} visible={weather((w) => w.trim() !== "")}>
        <label class="ir-sec-title" label="HAVA" halign={Gtk.Align.START} />
        <label class="ir-weather-val" label={weather((w) => w.trim())} halign={Gtk.Align.START} />
      </box>
    </box>
  )
  return PanelWindow({ name: "inforail", anchor: "right", child: card })
}

export default InfoRail
