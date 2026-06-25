// ════════════════════════════════════════════════════════════════
//  Power Menu — wlogout YERİNE AGS-native. Tam ekran dim backdrop +
//  ortada dairesel butonlar. Bar power island + Ctrl+Alt+Del açar.
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { execAsync } from "ags/process"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"

function PowerItem({
  icon,
  label,
  run,
  danger,
}: {
  icon: string
  label: string
  run: string[]
  danger?: boolean
}) {
  return (
    <box class="pm-item" vertical={true}>
      <button
        class={danger ? "pm-circle danger" : "pm-circle"}
        onClicked={() => {
          closePanel()
          execAsync(run).catch(() => {})
        }}
      >
        <label class="pm-ic" label={icon} />
      </button>
      <label class="pm-label" label={label} halign={Gtk.Align.CENTER} />
    </box>
  )
}

function PowerMenu() {
  const card = (
    <box class="pm" vertical={true}>
      <label class="pm-kanji" label="紅 墨" halign={Gtk.Align.CENTER} />
      <label class="pm-brand" label="KURENAI SUMI" halign={Gtk.Align.CENTER} />
      <box class="pm-row" halign={Gtk.Align.CENTER}>
        <PowerItem icon="󰌾" label="Kilitle" run={["hyprlock"]} />
        <PowerItem icon="󰗽" label="Çıkış" run={["hyprctl", "dispatch", "exit"]} />
        <PowerItem icon="󰤄" label="Uyku" run={["systemctl", "suspend"]} />
        <PowerItem icon="󰜉" label="Yeniden" run={["systemctl", "reboot"]} />
        <PowerItem icon="󰐥" label="Kapat" run={["systemctl", "poweroff"]} danger={true} />
      </box>
      <label class="pm-hint" label="Esc ile kapat" halign={Gtk.Align.CENTER} />
    </box>
  )
  // keyboard:true → EXCLUSIVE klavye, böylece Escape kapatır (hint ile uyumlu)
  return PanelWindow({ name: "power", anchor: "center", vcenter: true, keyboard: true, child: card })
}

export default PowerMenu
