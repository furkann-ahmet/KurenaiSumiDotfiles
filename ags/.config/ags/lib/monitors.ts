// ════════════════════════════════════════════════════════════════
//  Monitör yardımcıları — primary tespiti + active/focused monitör
//  Bar (hibrit topoloji) ve paneller (active monitor'de aç) bunu kullanır.
// ════════════════════════════════════════════════════════════════
import app from "ags/gtk3/app"
import { Gdk } from "ags/gtk3"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"

// Sistem "primary" (center) monitörü. Bu ad yoksa fallback devreye girer
// (en geniş monitör → o da yoksa ilk). Tek/iki monitörde de bozulmaz.
export const PRIMARY_CONNECTOR = "DP-3"

// GDK monitör → Hyprland connector adı (geometri ile en yakın eşleşme).
export function connectorFor(gdkmonitor: Gdk.Monitor): string {
  const hypr = Hyprland.get_default()
  const geo = gdkmonitor.get_geometry()
  let best = ""
  let bestDist = Infinity
  for (const m of hypr.get_monitors()) {
    const d = Math.abs(m.x - geo.x) + Math.abs(m.y - geo.y)
    if (d < bestDist) {
      bestDist = d
      best = m.name
    }
  }
  return best
}

// Primary connector'ı çöz: tercih edilen ad → en geniş → ilk.
export function primaryConnector(): string {
  const hypr = Hyprland.get_default()
  const mons = hypr.get_monitors()
  if (mons.length === 0) return PRIMARY_CONNECTOR
  if (mons.some((m) => m.name === PRIMARY_CONNECTOR)) return PRIMARY_CONNECTOR
  let best = mons[0]
  for (const m of mons) {
    if (m.width * m.height > best.width * best.height) best = m
  }
  return best.name
}

// Bu GDK monitör primary mi? (Bar: sistem island'ları yalnız primary'de.)
export function isPrimary(gdkmonitor: Gdk.Monitor): boolean {
  return connectorFor(gdkmonitor) === primaryConnector()
}

// ── Workspace ↔ monitör eşlemesi (Hyprland workspace rules'tan) ──
// Kullanıcının workspaces.conf'u workspace'leri monitörlere bağlıyor
// (örn. DP-3:1-4, DP-1:5-7, DP-2:8-10). Her monitör SADECE kendi bağlı
// workspace'lerini göstermeli. Bunu başlangıçta hyprctl'den okuyoruz.
let WS_BY_MONITOR: Record<string, number[]> | null = null

function loadWorkspaceRules(): Record<string, number[]> {
  const map: Record<string, number[]> = {}
  try {
    const [ok, out] = GLib.spawn_command_line_sync("hyprctl workspacerules -j")
    if (ok && out) {
      const rules = JSON.parse(new TextDecoder().decode(out)) as Array<{
        workspaceString?: string
        monitor?: string
      }>
      for (const r of rules) {
        const id = parseInt(r.workspaceString ?? "")
        if (r.monitor && Number.isFinite(id)) {
          ;(map[r.monitor] ??= []).push(id)
        }
      }
      for (const k in map) map[k].sort((a, b) => a - b)
    }
  } catch (e) {
    // sessizce boş dön → çağıran fallback uygular
  }
  return map
}

// Bu connector'a bağlı workspace id'leri. Kural yoksa boş döner.
export function workspacesForMonitor(connector: string): number[] {
  if (!WS_BY_MONITOR) WS_BY_MONITOR = loadWorkspaceRules()
  return WS_BY_MONITOR[connector] ?? []
}

// Faz 2: odaklı monitörün GDK karşılığı. Paneller burada açılacak.
export function activeGdkMonitor(): Gdk.Monitor | null {
  const hypr = Hyprland.get_default()
  const focused = hypr.focusedMonitor
  const monitors = app.get_monitors()
  if (focused) {
    for (const gm of monitors) {
      if (connectorFor(gm) === focused.name) return gm
    }
  }
  return monitors[0] ?? null
}
