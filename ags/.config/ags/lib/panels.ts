// ════════════════════════════════════════════════════════════════
//  Panel yöneticisi — TEKİL global durum.
//  Aynı anda tek panel açık. Toggle ile AKTİF (focused) monitörde açılır.
//  Hyprland keybind'leri `ags request <name>` ile buraya bağlanır.
// ════════════════════════════════════════════════════════════════
import { createState } from "ags"
import { Gdk } from "ags/gtk3"
import { activeGdkMonitor } from "./monitors"

export type PanelName =
  | "dashboard"
  | "appgrid"
  | "inforail"
  | "notifications"
  | "clipboard"
  | "power"
  | "record"
  | "expose"

const ALL: PanelName[] = [
  "dashboard",
  "appgrid",
  "inforail",
  "notifications",
  "clipboard",
  "power",
  "record",
  "expose",
]

const [active, setActive] = createState<PanelName | "none">("none")
const [monitor, setMonitor] = createState<Gdk.Monitor | null>(null)

export const activePanel = active
export const panelMonitor = monitor

export function togglePanel(name: PanelName) {
  if (active.get() === name) {
    setActive("none")
    return
  }
  const m = activeGdkMonitor()
  if (m) setMonitor(m)
  setActive(name)
}

export function closePanel() {
  setActive("none")
}

// `ags request <cmd>` → buraya. request string VEYA argv array olabilir → coerce.
export function handlePanelRequest(req: unknown): boolean {
  const cmd = (Array.isArray(req) ? req.join(" ") : String(req ?? ""))
    .trim() as PanelName
  if (ALL.includes(cmd)) {
    togglePanel(cmd)
    return true
  }
  return false
}
