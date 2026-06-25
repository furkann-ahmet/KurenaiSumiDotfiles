// ════════════════════════════════════════════════════════════════
//  AppGrid — bar'ın en solundaki "Başlat" butonuyla açılan GRID launcher.
//  Ekran ortasında tüm sistem uygulamalarını ızgara halinde listeler.
//  Üstte arama kutusu (boşken tüm uygulamalar alfabetik); Enter ilkini açar.
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { createState, For } from "ags"
import Apps from "gi://AstalApps"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"

const apps = new Apps.Apps()
const COLS = 5
const CELL_W = 146 // sabit hücre genişliği → sütunlar HİZALI kalır
// NOT: Astal.Icon boyutu CSS font-size (.ag-cell-ic) ile ayarlanır, pixelSize DEĞİL.
const ICON_PX = 62 // pixbuf fallback için; gerçek boyut SCSS'te
const NAME_CHARS = 13 // CELL_W'den dar olmalı, yoksa hücre genişler → kayma

// Tüm uygulamalar, isme göre alfabetik (boş arama görünümü).
function allApps(): Apps.Application[] {
  return apps
    .get_list()
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"))
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function AppGrid() {
  const [query, setQuery] = createState("")
  let entry: any = null

  // Boş arama → tüm uygulamalar; doluysa AstalApps fuzzy sıralaması.
  const listFor = (q: string) =>
    q.trim() ? apps.fuzzy_query(q) : allApps()

  const rows = query((q) => chunk(listFor(q), COLS))

  const launch = (app: Apps.Application) => {
    try {
      app.launch()
    } catch (e) {}
    closePanel()
  }

  const launchFirst = () => {
    const list = listFor(query.get())
    if (list.length > 0) launch(list[0])
  }

  const Cell = (app: Apps.Application) => (
    <button
      class="ag-cell"
      widthRequest={CELL_W}
      tooltipText={app.name || ""}
      onClicked={() => launch(app)}
    >
      <box vertical={true} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
        <icon
          class="ag-cell-ic"
          icon={app.iconName || "application-x-executable"}
          pixelSize={ICON_PX}
        />
        <label
          class="ag-cell-name"
          label={app.name || ""}
          justify={Gtk.Justification.CENTER}
          halign={Gtk.Align.CENTER}
          maxWidthChars={NAME_CHARS}
          widthChars={NAME_CHARS}
          ellipsize={3}
        />
      </box>
    </button>
  )

  const card = (
    <box class="ag" vertical={true}>
      <box class="ag-search">
        <label class="ag-search-ic" label="󰍉" valign={Gtk.Align.CENTER} />
        <entry
          class="ag-entry"
          hexpand
          placeholderText="Uygulama ara…"
          $={(self: any) => (entry = self)}
          onChanged={(self: any) => setQuery(self.text)}
          onActivate={launchFirst}
        />
      </box>

      <scrollable
        class="ag-scroll"
        hexpand
        vexpand
        hscroll={Gtk.PolicyType.NEVER}
        vscroll={Gtk.PolicyType.AUTOMATIC}
      >
        <box class="ag-grid" vertical={true} halign={Gtk.Align.CENTER}>
          <For each={rows}>
            {(row: Apps.Application[]) => (
              <box class="ag-row">
                {row.map(Cell)}
                {/* Eksik son satırı görünmez boşlukla doldur → öğeler
                    sütun altında HİZALI kalır (ortalı kaymaz). */}
                {Array.from({ length: COLS - row.length }).map(() => (
                  <box widthRequest={CELL_W} marginStart={4} marginEnd={4} />
                ))}
              </box>
            )}
          </For>
        </box>
      </scrollable>
    </box>
  )

  return PanelWindow({
    name: "appgrid",
    anchor: "center",
    keyboard: true,
    onReveal: () => {
      // açılışta arama temizle + odakla; grid tüm uygulamalara döner
      if (entry) {
        entry.set_text("")
        entry.grab_focus()
      }
      setQuery("")
    },
    child: card,
  })
}

export default AppGrid
