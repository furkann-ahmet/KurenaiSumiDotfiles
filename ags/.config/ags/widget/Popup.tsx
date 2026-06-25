import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createBinding, createComputed, createState, For, With, type Accessor } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"

export type PopupKind = "none" | "volume" | "network"

// ─────────────────────────────────────────────────────────────
// Ses kartı — pavucontrol yerine bar'a yapışık native popup
// ─────────────────────────────────────────────────────────────
function VolumeCard() {
  const wp = Wp.get_default()!
  const speaker = wp.audio.defaultSpeaker
  const vol = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")
  const desc = createBinding(speaker, "description")
  const icon = createComputed([vol, mute], (v, m) =>
    m ? "󰝟" : v < 0.34 ? "󰕿" : v < 0.67 ? "󰖀" : "󰕾",
  )
  // çıkış cihazları
  const speakers = createBinding(wp.audio, "speakers")((l) => l ?? [])
  const defSpeaker = createBinding(wp.audio, "defaultSpeaker")
  const [showDev, setShowDev] = createState(false)
  return (
    <box class="popup-card" vertical>
      <box class="popup-head">
        <label class="popup-ic" label={icon} />
        <label class="popup-title" label="Ses" />
        <box hexpand />
        <label class="popup-val" label={vol((v) => `${Math.round(v * 100)}%`)} />
      </box>
      <box class="popup-row">
        <button
          class="popup-mute"
          onClicked={() => (speaker.mute = !speaker.mute)}
        >
          <label class="icon" label={icon} />
        </button>
        <slider
          hexpand
          value={vol}
          min={0}
          max={1}
          step={0.01}
          onDragged={(self: any) => {
            const x = self.value
            if (Number.isFinite(x)) {
              speaker.volume = Math.max(0, Math.min(1, x))
              speaker.mute = false
            }
          }}
        />
      </box>

      {/* çıkış cihazı seçici (tıkla → aç/kapa) */}
      <button class="popup-devtoggle" onClicked={() => setShowDev(!showDev.get())}>
        <box>
          <label class="popup-sub" halign={Gtk.Align.START} label={desc((d) => `󰓃  ${d ?? "Çıkış"}`)} />
          <box hexpand />
          <label class="popup-sub" label={showDev((s) => (s ? "󰅃" : "󰅀"))} />
        </box>
      </button>
      <revealer
        revealChild={showDev}
        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
      >
        <box class="popup-list" vertical>
          <For each={speakers}>
            {(ep: any) => (
              <button
                class={defSpeaker((d: any) =>
                  d && d.id === ep.id ? "ap-row active" : "ap-row",
                )}
                onClicked={() => {
                  ep.set_is_default(true)
                  setShowDev(false)
                }}
              >
                <box>
                  <label class="ap-name" label={ep.description ?? ep.name ?? "Cihaz"} />
                  <box hexpand />
                  <label
                    class="ap-check"
                    label={defSpeaker((d: any) => (d && d.id === ep.id ? "󰄬" : ""))}
                  />
                </box>
              </button>
            )}
          </For>
        </box>
      </revealer>
    </box>
  )
}

// ─────────────────────────────────────────────────────────────
// Ağ kartı — Wi-Fi aç/kapa + taranan ağlar, tıkla-bağlan
// ─────────────────────────────────────────────────────────────
function dedupSort(list: any[]): any[] {
  const best = new Map<string, any>()
  for (const ap of list) {
    const id = ap.ssid
    if (!id) continue
    const prev = best.get(id)
    if (!prev || ap.strength > prev.strength) best.set(id, ap)
  }
  return [...best.values()].sort((a, b) => b.strength - a.strength).slice(0, 8)
}

function wifiGlyph(s: number): string {
  return s >= 75 ? "󰤨" : s >= 50 ? "󰤥" : s >= 25 ? "󰤢" : "󰤟"
}

// ─────────────────────────────────────────────────────────────
// VPN — nmcli ile connect/disconnect. Yapılandırılmış VPN yoksa gizli.
// Her satır tıklanınca up/down. Durum 4 sn'de bir tazelenir.
// ─────────────────────────────────────────────────────────────
function VpnSection() {
  const raw = createPoll("", 4000, "nmcli -t -f NAME,TYPE,STATE connection show")
  const vpns = raw((out) =>
    out
      .split("\n")
      .map((l) => l.split(":"))
      .filter((p) => p[1] === "vpn" || p[1] === "wireguard")
      .map((p) => ({ name: p[0], active: p[2] === "activated" })),
  )
  return (
    <box class="vpn-sec" vertical visible={vpns((v) => v.length > 0)}>
      <label class="popup-subhead" halign={Gtk.Align.START} label="VPN" />
      <For each={vpns}>
        {(v: { name: string; active: boolean }) => (
          <button
            class={v.active ? "ap-row active" : "ap-row"}
            onClicked={() =>
              execAsync(["nmcli", "connection", v.active ? "down" : "up", v.name]).catch(
                () => {},
              )
            }
          >
            <box>
              <label class="vpn-ic" label={v.active ? "󰦝" : "󰦞"} />
              <label class="ap-name" label={`  ${v.name}`} />
              <box hexpand />
              <label class="vpn-state" label={v.active ? "Bağlı" : "Bağlan"} />
            </box>
          </button>
        )}
      </For>
    </box>
  )
}

function NetworkCard({ setPopup }: { setPopup: (k: PopupKind) => void }) {
  const net = Network.get_default()
  const wifi = net.wifi

  // wifi yoksa (sadece kablolu) — sade durum kartı
  if (!wifi) {
    return (
      <box class="popup-card" vertical>
        <box class="popup-head">
          <label class="popup-ic" label="󰈀" />
          <label class="popup-title" label="Ağ" />
        </box>
        <label class="popup-sub" halign={Gtk.Align.START} label="Kablolu bağlantı (Wi-Fi yok)" />
        <VpnSection />
        <button
          class="popup-action"
          onClicked={() => {
            execAsync("nm-connection-editor")
            setPopup("none")
          }}
        >
          <label label="Ağ ayarları…" />
        </button>
      </box>
    )
  }

  wifi.scan() // kart açılınca tazele
  const enabled = createBinding(wifi, "enabled")
  const activeSsid = createBinding(wifi, "ssid")
  const aps = createBinding(wifi, "accessPoints")((list) => dedupSort(list))

  // şifre giriş durumu: hangi ssid için sorulduğu (null = kapalı), hata bayrağı
  const [authSsid, setAuthSsid] = createState<string | null>(null)
  const [authErr, setAuthErr] = createState(false)
  let pw = ""

  // password yoksa: kayıtlı/açık ağ → bağlanır; şifreli+kayıtsız → catch'te şifre iste.
  // password varsa: dene; hata → yanlış şifre, entry açık kalsın.
  const connect = (ssid: string, password: string | undefined, needsAuth: boolean) => {
    const cmd = password
      ? ["nmcli", "device", "wifi", "connect", ssid, "password", password]
      : ["nmcli", "device", "wifi", "connect", ssid]
    execAsync(cmd)
      .then(() => setPopup("none"))
      .catch(() => {
        if (password) setAuthErr(true) // yanlış şifre
        else if (needsAuth) {
          setAuthErr(false)
          setAuthSsid(ssid) // kayıtlı değil → şifre iste
        }
      })
  }

  return (
    <box class="popup-card" vertical>
      <box class="popup-head">
        <label class="popup-ic" label={enabled((e) => (e ? "󰖩" : "󰖪"))} />
        <label class="popup-title" label="Ağ" />
        <box hexpand />
        <switch
          active={enabled}
          onStateSet={(_self: any, state: boolean) => {
            if (state !== wifi.enabled) wifi.enabled = state
            return false
          }}
        />
      </box>

      <box class="popup-list" vertical visible={enabled}>
        <For each={aps}>
          {(ap: any) => (
            <button
              class={activeSsid((s) =>
                s && s === ap.ssid ? "ap-row active" : "ap-row",
              )}
              onClicked={() => {
                pw = ""
                connect(ap.ssid, undefined, !!ap.requiresPassword)
              }}
            >
              <box>
                <label class="icon" label={wifiGlyph(ap.strength)} />
                <label class="ap-name" label={`  ${ap.ssid}`} />
                <box hexpand />
                <label
                  class="ap-lock"
                  label={ap.requiresPassword ? "󰌾" : ""}
                />
                <label
                  class="ap-check"
                  label={activeSsid((s) => (s && s === ap.ssid ? "  󰄬" : ""))}
                />
              </box>
            </button>
          )}
        </For>
      </box>

      {/* şifre giriş satırı (yalnız şifreli+kayıtsız ağa tıklayınca) */}
      <With value={authSsid}>
        {(ssid: string | null) =>
          ssid ? (
            <box class="auth-row" vertical>
              <label
                class="popup-sub"
                halign={Gtk.Align.START}
                label={`󰌾  ${ssid}`}
              />
              <box class="auth-input">
                <entry
                  class="auth-entry"
                  hexpand
                  visibility={false}
                  placeholderText="Şifre…"
                  onChanged={(self: any) => {
                    pw = self.text
                    if (authErr.get()) setAuthErr(false)
                  }}
                  onActivate={() => connect(ssid, pw, true)}
                />
                <button
                  class="popup-action"
                  onClicked={() => connect(ssid, pw, true)}
                >
                  <label label="Bağlan" />
                </button>
                <button
                  class="popup-action"
                  onClicked={() => {
                    setAuthSsid(null)
                    setAuthErr(false)
                  }}
                >
                  <label label="İptal" />
                </button>
              </box>
              <label
                class="auth-err"
                halign={Gtk.Align.START}
                label="Yanlış şifre, tekrar dene"
                visible={authErr}
              />
            </box>
          ) : (
            <box />
          )
        }
      </With>

      <button
        class="popup-action"
        onClicked={() => {
          execAsync("nm-connection-editor")
          setPopup("none")
        }}
      >
        <label label="Ağ ayarları…" />
      </button>
    </box>
  )
}

// ─────────────────────────────────────────────────────────────
// Bar'a yapışık popup katmanı — tam ekran şeffaf backdrop,
// dışına tıkla / Escape = kapat. İçerik state'e göre değişir.
// ─────────────────────────────────────────────────────────────
export function BarPopups(
  gdkmonitor: Gdk.Monitor,
  popup: Accessor<PopupKind>,
  setPopup: (k: PopupKind) => void,
  popupX: Accessor<number>,
) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  // Kart genişliği (yaklaşık) — tetikleyicinin altına ortalamak + ekrana sığdırmak için.
  const CARD_W = 332
  const monW = gdkmonitor.get_geometry().width
  const marginStart = popupX((x) =>
    Math.max(8, Math.min(monW - CARD_W - 8, Math.round(x - CARD_W / 2))),
  )
  return (
    <window
      namespace="ags-popup"
      class="PopupLayer"
      gdkmonitor={gdkmonitor}
      // visible'ı $ içinde senkron uyguluyoruz: aksi halde binding ilk değeri
      // ancak ilk DEĞİŞİMDE uyguluyor → pencere doğuştan görünür kalıp startup'ta
      // tüm monitörü saniyelerce bloke ediyordu.
      $={(self: any) => {
        const sync = () => (self.visible = popup.get() !== "none")
        sync()
        popup.subscribe(sync)
      }}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.ON_DEMAND}
      // IGNORE: pencere TÜM monitörü kaplar (bar exclusive zone'unu yok sayar) →
      // backdrop her yeri tutar (dış tık kapatır) + marginTop ekran tepesinden ölçülür.
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
      onKeyPressEvent={(_w: any, ev: any) => {
        const [, key] = ev.get_keyval()
        if (key === Gdk.KEY_Escape) {
          setPopup("none")
          return true
        }
        return false
      }}
    >
      <eventbox
        hexpand
        vexpand
        onButtonPressEvent={() => {
          setPopup("none")
          return false
        }}
      >
        <box hexpand vexpand halign={Gtk.Align.START} valign={Gtk.Align.START}>
          {/* kart: tıklamayı yutar (backdrop'a düşmesin = kapanmasın).
              marginTop 54 → bar'ın (50px) hemen altı. marginStart → tetikleyicinin altı. */}
          <eventbox
            marginTop={54}
            marginStart={marginStart}
            onButtonPressEvent={() => true}
          >
            <With value={popup}>
              {(p: PopupKind) =>
                p === "volume" ? (
                  <VolumeCard />
                ) : p === "network" ? (
                  <NetworkCard setPopup={setPopup} />
                ) : (
                  <box />
                )
              }
            </With>
          </eventbox>
        </box>
      </eventbox>
    </window>
  )
}
