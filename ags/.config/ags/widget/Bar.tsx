import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createBinding, createComputed, createState, For, With } from "ags"
import { createPoll, interval } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Hyprland from "gi://AstalHyprland"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"
import Tray from "gi://AstalTray"
import { BarPopups, type PopupKind } from "./Popup"
import { connectorFor, isPrimary, workspacesForMonitor } from "../lib/monitors"
import { cpuPercent, ramUsed, cpuTemp, GPU_QUERY, parseGpu } from "../lib/sysinfo"
import { togglePanel } from "../lib/panels"

const WS_FALLBACK = [1, 2, 3, 4, 5] // kural yoksa (tek monitör / bağlama yok)

function fmt(sec: number) {
  sec = Math.max(0, Math.floor(sec))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`
}

// Bir bar butonunun merkez x'i (bar toplevel'ine göre = monitör-local).
// Popup'ı tetikleyici butonun ALTINA hizalamak için kullanılır.
function centerX(self: any): number {
  try {
    const top = self.get_toplevel()
    const r = self.translate_coordinates(top, 0, 0)
    const x = Array.isArray(r) ? Number(r[1]) : 0
    return (Number.isFinite(x) ? x : 0) + self.get_allocated_width() / 2
  } catch (e) {
    return 0
  }
}

// ─── Launcher island ──────────────────────────────────────────────
// GEÇİCİ: app launcher için şimdilik rofi drun. Faz 2'de AGS-native
// launcher penceresiyle değiştirilecek (manifesto: dark glass + crimson).
// ─── Workspaces (1-5 modeli, her monitör KENDİ aktifini vurgular) ──
function Workspaces(gdkmonitor: Gdk.Monitor) {
  const hypr = Hyprland.get_default()
  const conn = connectorFor(gdkmonitor)
  // Bu monitöre BAĞLI workspace'ler (workspaces.conf'tan). Yoksa fallback.
  const bound = workspacesForMonitor(conn)
  const ids = bound.length ? bound : WS_FALLBACK
  // Bu monitörde aktif olan workspace id'si. focusedWorkspace/monitors
  // değişince yeniden hesaplanır → workspace değiştirince anında güncellenir.
  const activeId = createComputed(
    [createBinding(hypr, "focusedWorkspace"), createBinding(hypr, "monitors")],
    () => {
      const m = hypr.get_monitors().find((mm) => mm.name === conn)
      return m?.activeWorkspace?.id ?? -1
    },
  )
  return (
    <box class="workspaces">
      {ids.map((id) => (
        <button
          class={activeId((a) => (a === id ? "active" : ""))}
          onClicked={() => hypr.dispatch("workspace", `${id}`)}
        >
          <label label={`${id}`} />
        </button>
      ))}
    </box>
  )
}

// ─── Active Window island ─────────────────────────────────────────
// Odaklı pencere başlığı; uzun başlıklar truncate. Pencere yoksa gizli.
function ActiveWindow() {
  const hypr = Hyprland.get_default()
  const client = createBinding(hypr, "focusedClient")
  const title = client((c) => (c ? c.title || c.class || "" : ""))
  return (
    <box class="activewin" visible={title((t) => t.trim() !== "")}>
      <label class="chev" label="▸" />
      <label
        label={title}
        maxWidthChars={32}
        ellipsize={3}
        halign={Gtk.Align.START}
      />
    </box>
  )
}

// ─── Minimized apps (taskbar) ─────────────────────────────────────
// SUPER+H aktif pencereyi `special:minimized`'e atar (gizlenir). O pencereler
// burada simge olur; tıklayınca aktif workspace'e geri gelir. Boşken gizli.
// rofi/menü YOK — tek tık. client-moved/added/removed ile canlı güncellenir.
const MINIMIZED_WS = "special:minimized"

// Pencere class'ından tema ikonu çöz (kitty, org.kde.dolphin, zen vb.).
// Bulunamazsa "" → çağıran fallback glyph'e düşer.
function iconForClass(cls: string): string {
  if (!cls) return ""
  const theme = Gtk.IconTheme.get_default()
  for (const c of [cls, cls.toLowerCase(), cls.split(".").pop() ?? ""]) {
    if (c && theme.has_icon(c)) return c
  }
  return ""
}

function MinimizedTray() {
  const hypr = Hyprland.get_default()
  const [items, setItems] = createState<Hyprland.Client[]>([])
  const refresh = () =>
    setItems(hypr.get_clients().filter((c) => c.workspace?.name === MINIMIZED_WS))
  refresh()
  // minimize/restore = workspace değişimi (client-moved); kapatma/açılma da yakala
  hypr.connect("client-moved", refresh)
  hypr.connect("client-added", refresh)
  hypr.connect("client-removed", refresh)

  const restore = (client: Hyprland.Client) => {
    const ws = hypr.focusedWorkspace?.id ?? 1
    // Astal `address` 0x öneki OLMADAN gelir; Hyprland dispatch `address:0x..` ister.
    const addr = client.address.startsWith("0x") ? client.address : `0x${client.address}`
    hypr.dispatch("movetoworkspacesilent", `${ws},address:${addr}`)
    hypr.dispatch("focuswindow", `address:${addr}`)
  }

  return (
    <box class="pill minimized" visible={items((i) => i.length > 0)}>
      <For each={items}>
        {(client: Hyprland.Client) => {
          const ico = iconForClass(client.class)
          return (
            <button
              class="min-item"
              tooltipText={`${client.class}  ·  ${client.title}`}
              onClicked={() => restore(client)}
            >
              {ico ? <icon icon={ico} /> : <label class="min-fallback" label="󰖲" />}
            </button>
          )
        }}
      </For>
    </box>
  )
}

// Kapak cache dizini (curl ile indirilen yerel dosyalar)
const ART_DIR = GLib.get_user_cache_dir() + "/ags-media-art"
GLib.mkdir_with_parents(ART_DIR, 0o755)

const MPRIS_PREFIX = "org.mpris.MediaPlayer2."
const MPRIS_PATH = "/org/mpris/MediaPlayer2"
const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player"

// AstalMpris hem manager (pre-existing kaçırıyor) hem Player.new (özellikleri
// canlı GÜNCELLEMİYOR — status/başlık donuyor) güvenilmez çıktı. Bu yüzden
// oynatıcıları ham Gio DBus proxy ile kendimiz modelliyoruz: g-properties-changed
// ile canlı, tam kontrol.
type PlayerModel = ReturnType<typeof makePlayer>

function makePlayer(busName: string) {
  const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)
  const proxy = Gio.DBusProxy.new_sync(
    bus, Gio.DBusProxyFlags.NONE, null, busName, MPRIS_PATH, PLAYER_IFACE, null,
  )
  const [status, setStatus] = createState("Stopped")
  const [title, setTitle] = createState("")
  const [artist, setArtist] = createState("")
  const [artUrl, setArtUrl] = createState("")
  const [length, setLength] = createState(0) // mikrosaniye

  const pull = () => {
    const s = proxy.get_cached_property("PlaybackStatus")
    setStatus(s ? (s.unpack() as string) : "Stopped")
    const md = proxy.get_cached_property("Metadata")
    if (md) {
      const m = md.recursiveUnpack() as Record<string, unknown>
      setTitle((m["xesam:title"] as string) ?? "")
      const a = m["xesam:artist"]
      setArtist(Array.isArray(a) ? a.join(", ") : ((a as string) ?? ""))
      setArtUrl((m["mpris:artUrl"] as string) ?? "")
      setLength(Number(m["mpris:length"] ?? 0))
    }
  }
  pull()
  proxy.connect("g-properties-changed", pull)

  const call = (method: string) => {
    try {
      proxy.call(method, null, Gio.DBusCallFlags.NONE, -1, null, null)
    } catch (e) {
      // yoksay
    }
  }
  const getPosition = () => {
    try {
      const r = bus.call_sync(
        busName, MPRIS_PATH, "org.freedesktop.DBus.Properties", "Get",
        new GLib.Variant("(ss)", [PLAYER_IFACE, "Position"]),
        null, Gio.DBusCallFlags.NONE, 400, null,
      )
      return Number((r.recursiveUnpack() as unknown[])[0] ?? 0)
    } catch (e) {
      return 0
    }
  }
  const getStatus = () => {
    const s = proxy.get_cached_property("PlaybackStatus")
    return s ? (s.unpack() as string) : "Stopped"
  }

  return {
    busName,
    status, title, artist, artUrl, length,
    getPosition,
    getStatus,
    onChange: (cb: () => void) => proxy.connect("g-properties-changed", cb),
    playPause: () => call("PlayPause"),
    next: () => call("Next"),
    previous: () => call("Previous"),
    // Pencereyi öne getir (MPRIS MediaPlayer2.Raise). Spotify tray "sadece-menü"
    // olduğu için tek güvenilir "göster" yolu bu.
    raise: () => {
      try {
        bus.call(
          busName, MPRIS_PATH, "org.mpris.MediaPlayer2", "Raise",
          null, null, Gio.DBusCallFlags.NONE, -1, null, null,
        )
      } catch (e) {
        // yoksay
      }
    },
  }
}

function MediaPlayer({ player }: { player: PlayerModel }) {
  const { title, artist, artUrl, status } = player

  // Kapağı kendimiz curl ile indirip yerel dosyayı gösteriyoruz (gvfs https takılıyor).
  const [coverPath, setCoverPath] = createState("")
  const updateCover = () => {
    const url = artUrl.get()
    if (!url) return setCoverPath("")
    if (url.startsWith("file://")) return setCoverPath(url.slice(7))
    const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, url, -1)
    const path = `${ART_DIR}/${hash}.jpg`
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) return setCoverPath(path)
    setCoverPath("")
    execAsync(["curl", "-sL", "-o", path, url])
      .then(() => setCoverPath(path))
      .catch(() => setCoverPath(""))
  }
  artUrl.subscribe(updateCover)
  updateCover()

  return (
    <box class="media" valign={Gtk.Align.CENTER}>
      {/* Kapak + başlık → tıkla pencereyi öne getir (Spotify'ı geri getirme) */}
      <button class="media-open" onClicked={() => player.raise()} tooltipText="Pencereyi öne getir">
        <box valign={Gtk.Align.CENTER}>
          <label
            class="art"
            valign={Gtk.Align.CENTER}
            widthRequest={26}
            heightRequest={26}
            xalign={0.47}
            yalign={0.5}
            label={coverPath((c) => (c ? "" : "󰝚"))}
            css={coverPath((c) => (c ? `background-image: url("file://${c}");` : ""))}
          />
          <box class="meta" vertical={true} valign={Gtk.Align.CENTER}>
            <label class="title" label={title((t) => t || "")} maxWidthChars={20} ellipsize={3} halign={Gtk.Align.START} />
            <label
              class="artist"
              label={artist((a) => a || "")}
              visible={artist((a) => a.trim() !== "")}
              maxWidthChars={22}
              ellipsize={3}
              halign={Gtk.Align.START}
            />
          </box>
        </box>
      </button>
      <box class="controls" valign={Gtk.Align.CENTER}>
        <button onClicked={() => player.previous()}>
          <label label="󰒮" />
        </button>
        <button class="pp" onClicked={() => player.playPause()}>
          <label label={status((s) => (s === "Playing" ? "󰏤" : "󰐊"))} />
        </button>
        <button onClicked={() => player.next()}>
          <label label="󰒭" />
        </button>
      </box>
    </box>
  )
}

// TÜM mpris oynatıcılarını (Spotify + tarayıcı + her şey) takip eder, ANLIK
// ÇALAN kaynağı aktif tutar. Aktif durunca başka çalan varsa ona geçer; hiçbir
// şey çalmazsa son kaynakta kalır. Pre-existing'i ListNames ile yakalar.
function trackActivePlayer() {
  const [active, setActive] = createState<PlayerModel | null>(null)
  let current: PlayerModel | null = null
  const map = new Map<string, PlayerModel>()
  const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)

  const setCur = (p: PlayerModel | null) => {
    current = p
    setActive(p)
  }
  const evaluate = (p: PlayerModel) => {
    if (p.getStatus() === "Playing") {
      setCur(p) // çalmaya başladı → aktif
    } else if (current === p) {
      // aktif DURDU → başka çalan varsa ona geç, yoksa burada kal
      const other = [...map.values()].find((o) => o !== p && o.getStatus() === "Playing")
      if (other) setCur(other)
    }
  }
  const add = (name: string) => {
    if (!name.startsWith(MPRIS_PREFIX) || map.has(name)) return
    if (name === MPRIS_PREFIX + "playerctld") return
    let player: PlayerModel
    try {
      player = makePlayer(name)
    } catch (e) {
      return
    }
    map.set(name, player)
    player.onChange(() => evaluate(player))
    if (current === null || player.getStatus() === "Playing") setCur(player)
  }
  const remove = (name: string) => {
    const player = map.get(name)
    if (!player) return
    map.delete(name)
    if (current === player) {
      const players = [...map.values()]
      setCur(players.find((p) => p.getStatus() === "Playing") ?? players[0] ?? null)
    }
  }

  // mevcut oynatıcılar
  const res = bus.call_sync(
    "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
    "ListNames", null, null, Gio.DBusCallFlags.NONE, -1, null,
  )
  for (const n of res.deepUnpack()[0] as string[]) add(n)
  const playingNow = [...map.values()].find((p) => p.getStatus() === "Playing")
  if (playingNow) setCur(playingNow)

  // canlı eklenme/çıkma
  bus.signal_subscribe(
    "org.freedesktop.DBus", "org.freedesktop.DBus", "NameOwnerChanged",
    "/org/freedesktop/DBus", null, Gio.DBusSignalFlags.NONE,
    (_c, _s, _p, _i, _sig, params: GLib.Variant) => {
      const [name, oldOwner, newOwner] = params.deepUnpack() as [string, string, string]
      if (!name.startsWith(MPRIS_PREFIX)) return
      if (newOwner !== "") add(name)
      else if (oldOwner !== "") remove(name)
    },
  )

  return active
}

function Media() {
  const active = trackActivePlayer()
  return (
    <box visible={active((p) => p !== null)}>
      <With value={active}>
        {(player: PlayerModel | null) =>
          player ? <MediaPlayer player={player} /> : <box />
        }
      </With>
    </box>
  )
}

// ─── System stats (CPU% / RAM / sıcaklık) — helper'lar lib/sysinfo'da ──
function SystemStats() {
  const cpu = createPoll(0, 2000, () => cpuPercent())
  const ram = createPoll(ramUsed(), 2000, () => ramUsed())
  const temp = createPoll(cpuTemp(), 2000, () => cpuTemp())
  const gpu = createPoll("", 3000, GPU_QUERY).as(parseGpu)
  return (
    <box class="stats" valign={Gtk.Align.CENTER}>
      <box class="s-group">
        <label class="s-ic" label="󰍛" />
        <label class="s-v" label={cpu((c) => `${c}%`)} />
      </box>
      <box class="s-group">
        <label class="s-ic" label="󰘚" />
        <label class="s-v" label={ram((r) => r)} />
      </box>
      <box class="s-group" visible={temp((t) => t !== "")}>
        <label
          class={temp((t) => (parseInt(t) >= 75 ? "s-ic hot" : "s-ic"))}
          label="󰔏"
        />
        <label
          class={temp((t) => (parseInt(t) >= 75 ? "s-v hot" : "s-v"))}
          label={temp((t) => t)}
        />
      </box>
      {/* GPU — util% + sıcaklık (≥80° kırmızı) */}
      <box class="s-group" tooltipText={gpu((g) => `VRAM ${g.memUsed} / ${g.memTotal} MB`)}>
        <label class="s-ic" label="󰢮" />
        <label class="s-v" label={gpu((g) => `${g.util}%`)} />
        <label class={gpu((g) => (g.temp >= 80 ? "s-v hot" : "s-v"))} label={gpu((g) => ` ${g.temp}°`)} />
      </box>
    </box>
  )
}

function Clock() {
  const time = createPoll("", 1000, "date +'%H:%M:%S   %a, %d %B'")
  return (
    <box class="pill clock">
      <label label={time} />
    </box>
  )
}

function Weather() {
  const w = createPoll("", 600000, `bash ${GLib.get_home_dir()}/.config/ags/scripts/weather.sh`)
  return (
    <box class="pill" visible={w((x) => x.trim() !== "")}>
      <label label={w((x) => x.trim())} />
    </box>
  )
}

function Updates() {
  // State tabanlı: açılışta + 30dk'da bir + güncelleme bitince anında yenilenir.
  const [counts, setCounts] = createState({ off: 0, aur: 0, total: 0 })
  const refresh = () =>
    execAsync(["bash", `${GLib.get_home_dir()}/.config/ags/scripts/updates.sh`])
      .then((s) => {
        const [o, a] = s.trim().split("|").map((n) => parseInt(n) || 0)
        setCounts({ off: o, aur: a, total: o + a })
      })
      .catch(() => {})
  refresh() // açılışta hemen
  interval(1800000, refresh) // 30dk periyodik (0 ise pill gizli kalır)

  return (
    <button
      class="right-mod"
      visible={counts((c) => c.total > 0)}
      tooltipText={counts((c) => `Resmi: ${c.off}  ·  AUR: ${c.aur}\nGüncellemek için tıkla`)}
      onClicked={() =>
        execAsync([
          "kitty",
          "-e",
          "bash",
          "-c",
          "paru -Syu; read -n1 -s -r -p 'Bitti — kapatmak için bir tuşa bas...'",
        ])
          .then(() => refresh()) // terminal kapanınca sayıyı anında güncelle
          .catch(() => refresh())
      }
    >
      <box>
        <label class="icon" label="󰚰" />
        <label label={counts((c) => `  ${c.total}`)} />
      </box>
    </button>
  )
}

function Notification() {
  const count = createPoll("0", 2000, "swaync-client -c")
  return (
    <button
      class="right-mod"
      visible={count((c) => c.trim() !== "0" && c.trim() !== "")}
      onClicked={() => execAsync("swaync-client -t -sw")}
    >
      <box>
        <label class="icon" label="󰂚" />
        <label label={count((c) => `  ${c.trim()}`)} />
      </box>
    </button>
  )
}

function Volume({ onToggle }: { onToggle: (x: number) => void }) {
  const wp = Wp.get_default()!
  const speaker = wp.audio.defaultSpeaker
  const vol = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")
  const icon = createComputed([vol, mute], (v, m) =>
    m ? "󰝟" : v < 0.34 ? "󰕿" : v < 0.67 ? "󰖀" : "󰕾",
  )
  return (
    <button
      class="right-mod"
      onClicked={(self: any) => onToggle(centerX(self))}
      onScroll={(_self: unknown, event: any) => {
        // gnim onScroll → "scroll" sinyali, handler'a tek event objesi geçer
        // ([dx,dy] AYRI sayı DEĞİL — eski kod bunu yanlış varsayıp NaN üretiyordu).
        // Bu farede dir=SMOOTH(4), delta_y=∓1.5 (yukarı/aşağı). Ayrık fareler için
        // UP/DOWN da ele alınır. Smooth'ta tek notch çok event ürettiği için ölçekli.
        let step = 0
        const dir = event?.direction
        if (dir === Gdk.ScrollDirection.UP) step = 0.05
        else if (dir === Gdk.ScrollDirection.DOWN) step = -0.05
        else {
          const dy = typeof event?.delta_y === "number" ? event.delta_y : 0
          step = -dy * 0.02
        }
        if (step === 0) return

        // NaN/çöp koruması (eski bug: volume NaN → pipewire değeri patlıyordu)
        const cur = speaker.volume
        const base = Number.isFinite(cur) ? cur : 0
        const next = Math.max(0, Math.min(1, base + step))
        if (Number.isFinite(next)) {
          speaker.volume = next
          speaker.mute = false
        }
      }}
    >
      <box>
        <label class="icon" label={icon} />
        <label label={vol((v) => `  ${Math.round(v * 100)}%`)} />
      </box>
    </button>
  )
}

function NetworkMod({ onToggle }: { onToggle: (x: number) => void }) {
  return (
    <button class="right-mod" onClicked={(self: any) => onToggle(centerX(self))}>
      <box>
        <label class="icon" label="󰈀" />
        <label label="  Bağlı" />
      </box>
    </button>
  )
}

// Tray ikon ismini aktif temada (Papirus) çözer. Renkli varyantı tercih eder
// (symbolic SVG'ler tray'de görünmez çizilebiliyor). Temada YOKSA "" döner →
// çağıran güvenilir gicon'a (AstalTray'in kendi derlediği) düşer. "Son parça"
// gibi tehlikeli tahmin YOK (yanlış ikon seçtiriyordu).
function resolveIcon(name: string): string {
  if (!name) return ""
  const theme = Gtk.IconTheme.get_default()
  const base = name.endsWith("-symbolic") ? name.slice(0, -9) : ""
  if (base && theme.has_icon(base)) return base
  if (theme.has_icon(name)) return name
  return ""
}

function TrayButton({ item }: { item: Tray.TrayItem }) {
  let widget: Gtk.Widget | null = null
  const resolved = createBinding(item, "iconName")((n) => resolveIcon(n))

  const openMenu = (event: any) => {
    const model = item.get_menu_model()
    if (!model) return false
    item.about_to_show()
    const menu = Gtk.Menu.new_from_model(model)
    const ag = item.get_action_group()
    if (ag) menu.insert_action_group("dbusmenu", ag)
    menu.attach_to_widget(widget!, null)
    if (event) menu.popup_at_pointer(event)
    else menu.popup_at_widget(widget!, Gdk.Gravity.SOUTH_WEST, Gdk.Gravity.NORTH_WEST, null)
    return true
  }

  return (
    <button
      tooltipText={createBinding(item, "title")}
      $={(self: Gtk.Widget) => {
        widget = self
        self.connect("button-press-event", (_w: Gtk.Widget, ev: any) => {
          const [, btn] = ev.get_button()
          if (btn === 3) return openMenu(ev) // sağ tık → menü
          return false
        })
      }}
      onClicked={() => {
        // sadece-menü uygulamaları activate'e yanıt vermez → menüyü aç
        if (item.get_is_menu()) {
          openMenu(null)
          return
        }
        // bazı app'ler (0,0)'ı yok sayıyor → butonun ekran koordinatını ver
        const win = widget?.get_window?.()
        let x = 0
        let y = 0
        if (win) {
          const o = win.get_origin()
          x = o[1]
          y = o[2]
        }
        item.activate(x, y)
      }}
    >
      <With value={resolved}>
        {(name: string) =>
          name ? (
            <icon icon={name} />
          ) : (
            <icon gicon={createBinding(item, "gicon")} />
          )
        }
      </With>
    </button>
  )
}

function SysTray() {
  const tray = Tray.get_default()
  const items = createBinding(tray, "items")
  return (
    <box class="pill tray" visible={items((i) => i.length > 0)}>
      <For each={items}>
        {(item: Tray.TrayItem) => <TrayButton item={item} />}
      </For>
    </box>
  )
}

function Power() {
  return (
    <button class="power" onClicked={() => togglePanel("power")}>
      <label label="󰐥" />
    </button>
  )
}

// ─── App grid launcher (Başlat) ───────────────────────────────────
// Bar'ın EN SOLU. Tıkla → ekran ortasında tüm uygulamalar GRID olarak açılır.
function AppGridButton() {
  return (
    <button
      class="appgrid-btn"
      tooltipText="Uygulamalar"
      onClicked={() => togglePanel("appgrid")}
    >
      <label class="appgrid-ic" label="󰀻" />
    </button>
  )
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  // Bu monitöre ait popup durumu (aynı ikona tekrar basmak kapatır).
  // popupX = tetikleyici butonun merkezi → kart onun altına hizalanır.
  const [popup, setPopup] = createState<PopupKind>("none")
  const [popupX, setPopupX] = createState(0)
  const toggle = (k: PopupKind, x: number) => {
    setPopupX(x)
    setPopup(popup.get() === k ? "none" : k)
  }

  // HİBRİT TOPOLOJİ: her monitörde Workspaces + Active Window var; ama
  // "sistem" island'ları (Launcher/Media/Stats/Tray/Clock/Power) yalnız
  // primary monitörde. Tray tek yerde kalır, kenar wallpaper'lar ferah.
  const primary = isPrimary(gdkmonitor)

  return (
    <>
      <window
        class="Bar"
        namespace="ags-bar"
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={TOP | LEFT | RIGHT}
        application={app}
      >
        {/* Manifesto sırası: Launcher · Workspaces · ActiveWindow ·
            Media · SystemStats · Tray · Clock · Power */}
        <centerbox>
          <box $type="start">
            <AppGridButton />
            {Workspaces(gdkmonitor)}
            <ActiveWindow />
            <MinimizedTray />
          </box>
          <box $type="center">{primary && <Media />}</box>
          <box $type="end" halign={Gtk.Align.END}>
            {primary && <SystemStats />}
            {primary && <NetworkMod onToggle={(x: number) => toggle("network", x)} />}
            {primary && <Volume onToggle={(x: number) => toggle("volume", x)} />}
            {primary && <Updates />}
            {primary && <Notification />}
            {primary && <SysTray />}
            {primary && <Clock />}
            {primary && <Weather />}
            {primary && <Power />}
          </box>
        </centerbox>
      </window>
      {primary && BarPopups(gdkmonitor, popup, setPopup, popupX)}
    </>
  )
}
