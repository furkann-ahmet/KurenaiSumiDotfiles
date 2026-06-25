// ════════════════════════════════════════════════════════════════
//  Masaüstü süsleri (BOTTOM layer) — boş masaüstünde görünür, pencere
//  açınca arkada kalır. Kurenai Sumi: cava görselleştirici.
// ════════════════════════════════════════════════════════════════
import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createBinding } from "ags"
import Cava from "gi://AstalCava"
import { isPrimary } from "../lib/monitors"

const BARS = 48
const MAX_H = 200 // px — bar tepe yüksekliği

function Visualizer() {
  const cava = Cava.get_default()
  if (!cava) return <box />
  cava.set_bars(BARS)
  const values = createBinding(cava, "values")
  return (
    <box class="cava" valign={Gtk.Align.END} halign={Gtk.Align.CENTER}>
      {Array.from({ length: BARS }, (_, i) => (
        <box
          class="cava-bar"
          valign={Gtk.Align.END}
          heightRequest={values((v) => Math.max(3, Math.round((v[i] ?? 0) * MAX_H)))}
        />
      ))}
    </box>
  )
}

export default function Desktop(gdkmonitor: Gdk.Monitor) {
  // Sadece primary monitörde (tek yer yeter, kenarlar ferah kalsın)
  if (!isPrimary(gdkmonitor)) return null
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  return (
    <window
      class="Desktop"
      namespace="ags-desktop"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.BOTTOM}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
    >
      <box vertical={true}>
        <box vexpand={true} />
        {/* Cava: alt-orta */}
        <box class="cava-wrap" halign={Gtk.Align.CENTER} valign={Gtk.Align.END}>
          <Visualizer />
        </box>
      </box>
    </window>
  )
}
