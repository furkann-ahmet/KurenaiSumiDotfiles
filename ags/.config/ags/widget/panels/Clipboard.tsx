// ════════════════════════════════════════════════════════════════
//  Clipboard (Super+V) — cliphist geçmişi. Ara + tıkla-kopyala.
//  rofi tabanlı eski akışı değiştirir. Aktif monitörde ortada açılır.
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { createState, createComputed, For } from "ags"
import { execAsync } from "ags/process"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"

const MAX = 60

function Clipboard() {
  const [items, setItems] = createState<string[]>([])
  const [query, setQuery] = createState("")
  let entry: any = null

  const filtered = createComputed([items, query], (its, q) => {
    const list = q
      ? its.filter((l) => l.toLowerCase().includes(q.toLowerCase()))
      : its
    return list.slice(0, MAX)
  })

  const refresh = () => {
    execAsync(["cliphist", "list"])
      .then((out) => setItems(out.split("\n").filter((l) => l.trim() !== "")))
      .catch(() => setItems([]))
  }

  const copy = (line: string) => {
    // satırı argv olarak geçir (kaçış sorunu olmasın) → cliphist decode → wl-copy
    execAsync(["bash", "-c", 'printf "%s" "$1" | cliphist decode | wl-copy', "_", line]).catch(
      () => {},
    )
    closePanel()
  }

  // "123\tönizleme metni" → görünen kısım
  const preview = (line: string) => line.replace(/^\d+\t/, "")

  const card = (
    <box class="clip" vertical={true}>
      <box class="clip-search">
        <label class="clip-search-ic" label="󰉹" valign={Gtk.Align.CENTER} />
        <entry
          class="clip-entry"
          hexpand
          placeholderText="Panoda ara…"
          $={(self: any) => (entry = self)}
          onChanged={(self: any) => setQuery(self.text)}
        />
      </box>

      <scrollable class="clip-scroll" vexpand>
        <box class="clip-list" vertical={true}>
          <For each={filtered}>
            {(line: string) => (
              <button class="clip-row" onClicked={() => copy(line)}>
                <label
                  class="clip-row-text"
                  label={preview(line)}
                  halign={Gtk.Align.START}
                  maxWidthChars={44}
                  ellipsize={3}
                  xalign={0}
                />
              </button>
            )}
          </For>
        </box>
      </scrollable>
    </box>
  )

  return PanelWindow({
    name: "clipboard",
    anchor: "center",
    keyboard: true,
    onReveal: () => {
      refresh()
      setQuery("")
      if (entry) {
        entry.set_text("")
        entry.grab_focus()
      }
    },
    child: card,
  })
}

export default Clipboard
