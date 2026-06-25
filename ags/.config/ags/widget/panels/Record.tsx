// ════════════════════════════════════════════════════════════════
//  Ekran Kaydı paneli (Super+R) — gpu-screen-recorder (NVENC) önyüzü.
//  Kaynak (tüm ekran / alan seç) + ses (sistem / mikrofon) seç → başlat.
//  Kayıt scripts/record.sh ile yürütülür; durum yüzen gösterge'de.
// ════════════════════════════════════════════════════════════════
import GLib from "gi://GLib"
import { Gtk } from "ags/gtk3"
import { createState } from "ags"
import { execAsync } from "ags/process"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"

const SCRIPT = `${GLib.get_home_dir()}/.config/ags/scripts/record.sh`

function Record() {
  const [mode, setMode] = createState<"full" | "region">("full")
  const [mic, setMic] = createState(false)
  const [sys, setSys] = createState(true)

  // Segment butonu (radyo gibi: kaynak seçimi)
  const Seg = ({ value, icon, label }: { value: "full" | "region"; icon: string; label: string }) => (
    <button
      class={mode((m) => (m === value ? "rec-seg-btn active" : "rec-seg-btn"))}
      onClicked={() => setMode(value)}
      hexpand
    >
      <box halign={Gtk.Align.CENTER}>
        <label class="rec-seg-ic" label={icon} />
        <label label={label} />
      </box>
    </button>
  )

  // Onay kutusu butonu (ses kaynağı aç/kapa)
  const Check = ({
    state,
    toggle,
    icon,
    label,
  }: {
    state: any
    toggle: () => void
    icon: string
    label: string
  }) => (
    <button class={state((on: boolean) => (on ? "rec-check on" : "rec-check"))} onClicked={toggle}>
      <box>
        <label class="rec-check-box" label={state((on: boolean) => (on ? "󰄬" : ""))} />
        <label class="rec-check-ic" label={icon} />
        <label label={label} />
      </box>
    </button>
  )

  const start = () => {
    const args = ["bash", SCRIPT, "start", mode.get(), mic.get() ? "1" : "0", sys.get() ? "1" : "0"]
    // Önce paneli kapat: "alan seç"te slurp'ün ekranı görmesi için şart.
    closePanel()
    execAsync(args).catch(() => {})
  }

  const card = (
    <box class="rec" vertical={true}>
      <label class="rec-title" label="󰑊  Ekran Kaydı" halign={Gtk.Align.START} />

      <label class="rec-section" label="KAYNAK" halign={Gtk.Align.START} />
      <box class="rec-seg" homogeneous={true}>
        <Seg value="full" icon="󰍹" label="Tüm ekran" />
        <Seg value="region" icon="󰒉" label="Alan seç" />
      </box>

      <label class="rec-section" label="SES" halign={Gtk.Align.START} />
      <Check state={sys} toggle={() => setSys(!sys.get())} icon="󰕾" label="Sistem sesi" />
      <Check state={mic} toggle={() => setMic(!mic.get())} icon="󰍬" label="Mikrofon" />

      <button class="rec-start" onClicked={start}>
        <box halign={Gtk.Align.CENTER}>
          <label class="rec-start-dot" label="󰻃" />
          <label label="Kaydı Başlat" />
        </box>
      </button>
      <label class="rec-hint" label="Esc ile kapat" halign={Gtk.Align.CENTER} />
    </box>
  )

  return PanelWindow({ name: "record", anchor: "center", vcenter: true, keyboard: true, child: card })
}

export default Record
