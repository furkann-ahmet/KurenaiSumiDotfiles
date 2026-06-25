// ════════════════════════════════════════════════════════════════
//  Dashboard paneli (Super+D) — canon board'daki sol monitör paneli.
//  Büyük saat/tarih · takvim · sistem özeti · hızlı kontroller.
//  Aktif monitörde, sol-anchored overlay olarak açılır.
// ════════════════════════════════════════════════════════════════
import { Gtk } from "ags/gtk3"
import { For, createBinding } from "ags"
import Pp from "gi://AstalPowerProfiles"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import PanelWindow from "../common/PanelWindow"
import { closePanel } from "../../lib/panels"
import {
  cpuPercent,
  ramUsed,
  ramFraction,
  cpuTemp,
  uptimePretty,
  netRates,
  GPU_QUERY,
  parseGpu,
  DISK_QUERY,
  parseDisks,
  type DiskInfo,
  WEATHER_QUERY,
  parseWeather,
  type WeatherDay,
} from "../../lib/sysinfo"

// hızlı kontrol butonu — çalıştır ve paneli kapat
function Quick({ icon, label, run }: { icon: string; label: string; run: string[] }) {
  return (
    <button
      class="dash-quick-btn"
      onClicked={() => {
        execAsync(run).catch(() => {})
        closePanel()
      }}
    >
      <box vertical={true} valign={Gtk.Align.CENTER}>
        <label class="dash-quick-ic" label={icon} halign={Gtk.Align.CENTER} />
        <label class="dash-quick-lbl" label={label} halign={Gtk.Align.CENTER} />
      </box>
    </button>
  )
}

// Performans/Denge toggle — power-profiles-daemon (sudosuz, polkit).
// performance ↔ balanced; performansta kırmızı yanar. Panel kapanmaz
// (durum değişimini göresin diye) → Quick'ten farklı bileşen.
function PerfToggle() {
  const pp = Pp.get_default()!
  const active = createBinding(pp, "activeProfile")
  const isPerf = active((p) => p === "performance")
  const toggle = () =>
    pp.set_active_profile(pp.activeProfile === "performance" ? "balanced" : "performance")
  return (
    <button class={isPerf((on) => (on ? "dash-quick-btn active" : "dash-quick-btn"))} onClicked={toggle}>
      <box vertical={true} valign={Gtk.Align.CENTER}>
        <label class="dash-quick-ic" label={isPerf((on) => (on ? "󰓅" : "󰾆"))} halign={Gtk.Align.CENTER} />
        <label class="dash-quick-lbl" label={isPerf((on) => (on ? "Perf" : "Denge"))} halign={Gtk.Align.CENTER} />
      </box>
    </button>
  )
}

// Manuel fill-bar: track sabit genişlik, dolgu widthRequest = oran × genişlik.
// (Gtk.LevelBar value'su gnim'de güvenilir uygulanmadı.)
const BAR_W = 256
function StatRow({
  icon,
  label,
  value,
  frac,
}: {
  icon: string
  label: string
  value: any
  frac: any
}) {
  return (
    <box class="dash-stat" vertical={true}>
      <box class="dash-stat-top">
        <label class="dash-stat-ic" label={icon} />
        <label class="dash-stat-lbl" label={label} />
        <box hexpand />
        <label class="dash-stat-val" label={value} />
      </box>
      <box class="dash-bar" widthRequest={BAR_W} halign={Gtk.Align.START}>
        <box
          class="dash-bar-fill"
          halign={Gtk.Align.START}
          widthRequest={frac((f: number) =>
            Math.max(3, Math.round(Math.max(0, Math.min(1, f)) * BAR_W)),
          )}
        />
      </box>
    </box>
  )
}

// Disk satırı — StatRow'a benzer ama frac düz sayı (For içinden statik gelir).
// ≥%90 doluluk kırmızı uyarı sınıfı alır.
function DiskRow({ d }: { d: DiskInfo }) {
  const warn = d.frac >= 0.9
  return (
    <box class="dash-stat" vertical={true}>
      <box class="dash-stat-top">
        <label class="dash-stat-ic" label="󰋊" />
        <label class="dash-stat-lbl" label={d.label} />
        <box hexpand />
        <label
          class={warn ? "dash-stat-val hot" : "dash-stat-val"}
          label={`${d.usedH} / ${d.totalH}`}
        />
      </box>
      <box class="dash-bar" widthRequest={BAR_W} halign={Gtk.Align.START}>
        <box
          class={warn ? "dash-bar-fill hot" : "dash-bar-fill"}
          halign={Gtk.Align.START}
          widthRequest={Math.max(3, Math.round(d.frac * BAR_W))}
        />
      </box>
    </box>
  )
}

// Tahmin satırı — gün · ikon · açıklama · min/max (For içinden statik gelir).
function WeatherDayRow({ d }: { d: WeatherDay }) {
  return (
    <box class="dash-wx-day">
      <label class="dash-wx-day-name" label={d.day} />
      <label class="dash-wx-day-ic" label={d.icon} />
      <label class="dash-wx-day-desc" label={d.desc} />
      <box hexpand />
      <label class="dash-wx-day-max" label={d.max} />
      <label class="dash-wx-day-min" label={d.min} />
    </box>
  )
}

function Dashboard() {
  const clock = createPoll("", 1000, "date +'%H:%M'")
  const date = createPoll("", 30000, "date +'%A, %d %B %Y'")
  const cpu = createPoll(0, 2000, () => cpuPercent())
  const ram = createPoll(ramUsed(), 2000, () => ramUsed())
  const ramF = createPoll(ramFraction(), 2000, () => ramFraction())
  const temp = createPoll(cpuTemp(), 2000, () => cpuTemp())
  const up = createPoll(uptimePretty(), 30000, () => uptimePretty())
  const gpu = createPoll("", 3000, GPU_QUERY).as(parseGpu)
  const net = createPoll(netRates(), 2000, () => netRates())
  // Disk doluluğu yavaş değişir → 30s yeterli (4 btrfs noktası tek script).
  const disks = createPoll("", 30000, DISK_QUERY).as(parseDisks)
  // Hava — 30dk poll. Boş/internet yok → null → bölüm gizlenir.
  const wx = createPoll("", 1800000, WEATHER_QUERY).as(parseWeather)
  const wxDays = wx.as((w) => w?.days ?? [])

  const card = (
    <box class="dash" vertical={true}>
      {/* saat + tarih */}
      <box class="dash-head" vertical={true}>
        <label class="dash-clock" label={clock} halign={Gtk.Align.START} />
        <label class="dash-date" label={date} halign={Gtk.Align.START} />
      </box>

      {/* takvim — Gtk.Calendar gnim intrinsic değil, imperative ekliyoruz */}
      <box
        class="dash-cal-wrap"
        $={(self: any) => {
          const cal = new Gtk.Calendar()
          cal.get_style_context().add_class("dash-cal")
          cal.set_hexpand(true)
          self.add(cal)
          cal.show()
        }}
      />

      {/* hava durumu — anlık + 3 günlük tahmin (internet yoksa gizli) */}
      <box class="dash-section dash-wx" vertical={true} visible={wx.as((w) => w !== null)}>
        <box class="dash-wx-now">
          <label class="dash-wx-now-ic" label={wx.as((w) => w?.now.icon ?? "")} />
          <box vertical={true} valign={Gtk.Align.CENTER}>
            <label
              class="dash-wx-now-temp"
              halign={Gtk.Align.START}
              label={wx.as((w) => w?.now.temp ?? "")}
            />
            <label
              class="dash-wx-now-desc"
              halign={Gtk.Align.START}
              label={wx.as((w) => (w ? `${w.now.desc} · Hissedilen ${w.now.feels}` : ""))}
            />
          </box>
          <box hexpand />
          <box class="dash-wx-meta" vertical={true} valign={Gtk.Align.CENTER}>
            <label halign={Gtk.Align.END} label={wx.as((w) => (w ? `󰖎  ${w.now.humidity}` : ""))} />
            <label halign={Gtk.Align.END} label={wx.as((w) => (w ? `󰖝  ${w.now.wind}` : ""))} />
          </box>
        </box>
        <box class="dash-wx-sun">
          <label label={wx.as((w) => (w ? `󰖜  ${w.sunrise}` : ""))} />
          <box hexpand />
          <label label={wx.as((w) => (w ? `󰖛  ${w.sunset}` : ""))} />
        </box>
        <For each={wxDays}>{(d: WeatherDay) => <WeatherDayRow d={d} />}</For>
      </box>

      {/* sistem özeti */}
      <box class="dash-section" vertical={true}>
        <box class="dash-sec-head">
          <label class="dash-sec-title" label="SİSTEM" />
          <box hexpand />
          <label class="dash-up" label={up((u) => `󰅐  ${u}`)} />
        </box>
        <StatRow icon="󰍛" label="İşlemci" value={cpu((c) => `${c}%`)} frac={cpu((c) => c / 100)} />
        <StatRow icon="󰘚" label="Bellek" value={ram} frac={ramF} />
        <StatRow
          icon="󰢮"
          label="Ekran kartı"
          value={gpu((g) => `${g.util}%  ·  ${g.memUsed}/${g.memTotal} MB`)}
          frac={gpu((g) => g.util / 100)}
        />
        <box class="dash-temp">
          <label class="dash-stat-ic" label="󰔏" />
          <label class="dash-stat-lbl" label="Sıcaklık" />
          <box hexpand />
          <label class="dash-stat-val" label={temp((t) => t || "—")} />
          <label class="dash-stat-sep" label="󰢮" />
          <label class="dash-stat-val" label={gpu((g) => `${g.temp}°`)} />
        </box>
        <box class="dash-temp">
          <label class="dash-stat-ic" label="󰛳" />
          <label class="dash-stat-lbl" label="Ağ" />
          <box hexpand />
          <label class="dash-stat-val" label={net((n) => `󰇚 ${n.down}  󰕒 ${n.up}`)} />
        </box>
      </box>

      {/* depolama — tüm btrfs noktaları (gerçek kullanım) */}
      <box class="dash-section" vertical={true}>
        <box class="dash-sec-head">
          <label class="dash-sec-title" label="DEPOLAMA" />
        </box>
        <For each={disks}>{(d: DiskInfo) => <DiskRow d={d} />}</For>
      </box>

      {/* hızlı kontroller */}
      <box class="dash-quick" homogeneous={true}>
        <PerfToggle />
        <Quick icon="󰌾" label="Kilit" run={["hyprlock"]} />
        <Quick icon="󰹑" label="SS" run={["bash", "-c", "grim -g \"$(slurp)\" - | swappy -f -"]} />
        <Quick icon="󰂛" label="Sessiz" run={["swaync-client", "-d", "-sw"]} />
        <Quick icon="󰖔" label="Gece" run={["bash", "-c", "pkill hyprsunset || hyprsunset -t 4000"]} />
        <Quick icon="󰐥" label="Güç" run={["ags", "request", "power"]} />
      </box>
    </box>
  )

  return PanelWindow({ name: "dashboard", anchor: "left", child: card })
}

export default Dashboard
