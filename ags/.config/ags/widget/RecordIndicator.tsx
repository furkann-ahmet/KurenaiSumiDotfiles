// ════════════════════════════════════════════════════════════════
//  Yüzen kayıt göstergesi — kayıt sürerken primary monitörde sağ üstte
//  (bar altında) belirir: yanan kırmızı nokta + geçen süre. Tıkla → durdur.
//  Üst bara HİÇ dokunmaz; bağımsız OVERLAY pencere.
// ════════════════════════════════════════════════════════════════
import app from "ags/gtk3/app"
import GLib from "gi://GLib"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createComputed } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { isPrimary } from "../lib/monitors"

const SCRIPT = `${GLib.get_home_dir()}/.config/ags/scripts/record.sh`

function fmtElapsed(sec: number): string {
  if (sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function RecordIndicator() {
  const { TOP, RIGHT } = Astal.WindowAnchor

  // Durum: "rec <epoch>" | "idle" (1s poll). + saniye tıklayan zaman kaynağı.
  const status = createPoll("idle", 1000, `bash ${SCRIPT} status`)
  const now = createPoll(0, 1000, () => Math.floor(GLib.get_real_time() / 1e6))

  const recording = status.as((s) => s.startsWith("rec"))
  const elapsed = createComputed([status, now], (st, n) => {
    if (!st.startsWith("rec")) return "00:00"
    const start = Number(st.split(" ")[1]) || n
    return fmtElapsed(n - start)
  })

  const stop = () => execAsync(["bash", SCRIPT, "stop"]).catch(() => {})

  const primaryMon: Gdk.Monitor | undefined = app.get_monitors().find(isPrimary)

  return (
    <window
      namespace="ags-recind"
      class="RecInd"
      gdkmonitor={primaryMon}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | RIGHT}
      application={app}
      // visible'ı senkron tut (binding ilk değer gecikmesi sorununu önle).
      $={(self: any) => {
        const sync = () => (self.visible = recording.get())
        sync()
        recording.subscribe(sync)
      }}
    >
      <box marginTop={58} marginEnd={14}>
        <button class="recind-btn" onClicked={stop} tooltipText="Kaydı durdur">
          <box>
            <label class="recind-dot" label="󰻃" />
            <label class="recind-time" label={elapsed} />
            <label class="recind-stop" label="󰓛" />
          </box>
        </button>
      </box>
    </window>
  )
}
