// ════════════════════════════════════════════════════════════════
//  Ortak overlay panel penceresi.
//  - Tekil global pencere; panelMonitor ile AKTİF monitöre taşınır.
//  - Tam ekran (exclusivity IGNORE) → backdrop her dış tıkı yakalar.
//  - Dış tık / Escape kapatır. Kart bir kenara hizalanır (bar altında).
// ════════════════════════════════════════════════════════════════
import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import {
  activePanel,
  panelMonitor,
  closePanel,
  type PanelName,
} from "../../lib/panels"

type Anchor = "left" | "right" | "center"

export default function PanelWindow({
  name,
  anchor,
  child,
  keyboard = false,
  vcenter = false,
  onReveal,
}: {
  name: PanelName
  anchor: Anchor
  child: any
  keyboard?: boolean // true → EXCLUSIVE klavye (arama girişi yazabilsin)
  vcenter?: boolean // true → ekranda dikey ortalı (power menüsü gibi)
  onReveal?: () => void // panel açıldığında çağrılır (örn. entry.grab_focus)
}) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const halign =
    anchor === "right"
      ? Gtk.Align.END
      : anchor === "left"
        ? Gtk.Align.START
        : Gtk.Align.CENTER
  const valign = vcenter ? Gtk.Align.CENTER : Gtk.Align.START

  // Kart konumu: bar altından başlasın; kenar panellerinde kenar boşluğu.
  const marginTop = vcenter ? 0 : anchor === "center" ? 70 : 58
  const sideMargin = 14

  return (
    <window
      namespace={`ags-${name}`}
      class={`Panel panel-${name}`}
      gdkmonitor={panelMonitor}
      // visible'ı senkron ayarla (binding ilk değeri gecikmeli uygular sorunu).
      $={(self: any) => {
        const sync = () => {
          const vis = activePanel.get() === name
          self.visible = vis
          if (vis && onReveal) onReveal()
        }
        sync()
        activePanel.subscribe(sync)
      }}
      layer={Astal.Layer.TOP}
      keymode={keyboard ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.ON_DEMAND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
      onKeyPressEvent={(_w: any, ev: any) => {
        const [, key] = ev.get_keyval()
        if (key === Gdk.KEY_Escape) {
          closePanel()
          return true
        }
        return false
      }}
    >
      <eventbox
        hexpand
        vexpand
        onButtonPressEvent={() => {
          closePanel()
          return false
        }}
      >
        <box hexpand vexpand halign={halign} valign={valign}>
          {/* kart: tıklamayı yutar (backdrop'a düşmesin = kapanmasın) */}
          <eventbox
            marginTop={marginTop}
            marginStart={sideMargin}
            marginEnd={sideMargin}
            onButtonPressEvent={() => true}
          >
            {child}
          </eventbox>
        </box>
      </eventbox>
    </window>
  )
}
