// ════════════════════════════════════════════════════════════════
//  Exposé / Genel bakış (Super+A) — açık tüm pencereler workspace'e
//  göre gruplu kart ızgarası. Karta tıkla → o pencereye atla (gerekirse
//  workspace değişir). 3-monitör kurulumda hızlı pencere bulma.
//  Canlı: client ekl/sil/taşı olaylarıyla güncellenir.
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { createState, For } from "ags"
import Hyprland from "gi://AstalHyprland"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"

// Pencere class'ından tema ikonu çöz (Bar'daki ile aynı mantık).
function iconForClass(cls: string): string {
  if (!cls) return ""
  const theme = Gtk.IconTheme.get_default()
  for (const c of [cls, cls.toLowerCase(), cls.split(".").pop() ?? ""]) {
    if (c && theme.has_icon(c)) return c
  }
  return ""
}

type WsGroup = { ws: number; clients: Hyprland.Client[] }

function Expose() {
  const hypr = Hyprland.get_default()
  const [groups, setGroups] = createState<WsGroup[]>([])

  const refresh = () => {
    // Özel (special) workspace'leri (id ≤ 0) ele; başlığı/class'ı olanları al.
    const clients = hypr
      .get_clients()
      .filter((c) => c.workspace && c.workspace.id > 0 && (c.title || c.class))
    const byWs = new Map<number, Hyprland.Client[]>()
    for (const c of clients) {
      const id = c.workspace.id
      if (!byWs.has(id)) byWs.set(id, [])
      byWs.get(id)!.push(c)
    }
    const out: WsGroup[] = [...byWs.keys()]
      .sort((a, b) => a - b)
      .map((ws) => ({ ws, clients: byWs.get(ws)! }))
    setGroups(out)
  }
  refresh()
  hypr.connect("client-added", refresh)
  hypr.connect("client-removed", refresh)
  hypr.connect("client-moved", refresh)
  hypr.connect("notify::clients", refresh)

  const focus = (c: Hyprland.Client) => {
    const addr = c.address.startsWith("0x") ? c.address : `0x${c.address}`
    closePanel()
    hypr.dispatch("focuswindow", `address:${addr}`)
  }

  const Card = (c: Hyprland.Client) => {
    const ico = iconForClass(c.class)
    return (
      <button class="expose-card" tooltipText={`${c.class}  ·  ${c.title}`} onClicked={() => focus(c)}>
        <box vertical={true} valign={Gtk.Align.CENTER}>
          <box class="expose-card-ic" halign={Gtk.Align.CENTER}>
            {ico ? (
              <icon icon={ico} $={(self: any) => self.set_pixel_size(34)} />
            ) : (
              <label class="expose-card-fallback" label="󰖲" />
            )}
          </box>
          <label
            class="expose-card-title"
            label={c.title || c.class}
            maxWidthChars={16}
            ellipsize={3}
            halign={Gtk.Align.CENTER}
          />
        </box>
      </button>
    )
  }

  const card = (
    <box class="expose" vertical={true}>
      <box class="expose-head">
        <label class="expose-title" label="󰏃  Genel Bakış" />
        <box hexpand />
        <label class="expose-hint" label="tıkla → atla · Esc kapat" />
      </box>
      <box class="expose-empty" visible={groups((g) => g.length === 0)}>
        <label label="Açık pencere yok" halign={Gtk.Align.CENTER} hexpand />
      </box>
      <For each={groups}>
        {(g: WsGroup) => (
          <box class="expose-ws" vertical={true}>
            <label class="expose-ws-badge" label={`Çalışma alanı ${g.ws}`} halign={Gtk.Align.START} />
            <box class="expose-row">{g.clients.map((c) => Card(c))}</box>
          </box>
        )}
      </For>
    </box>
  )

  return PanelWindow({ name: "expose", anchor: "center", vcenter: true, keyboard: true, child: card })
}

export default Expose
