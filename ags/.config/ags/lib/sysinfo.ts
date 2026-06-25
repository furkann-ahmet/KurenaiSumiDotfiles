// ════════════════════════════════════════════════════════════════
//  Sistem bilgisi okuyucuları — /proc + /sys (harici bağımlılık yok)
//  Bar (SystemStats) ve Dashboard ortak kullanır.
// ════════════════════════════════════════════════════════════════
import GLib from "gi://GLib"

export function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(bytes) : ""
  } catch (e) {
    return ""
  }
}

// CPU% — /proc/stat delta (idle+iowait dışı zaman / toplam).
let prevIdle = 0
let prevTotal = 0
export function cpuPercent(): number {
  const line = readFile("/proc/stat").split("\n")[0]
  const p = line.trim().split(/\s+/).slice(1).map(Number)
  if (p.length < 4) return 0
  const idle = p[3] + (p[4] || 0)
  const total = p.reduce((a, b) => a + b, 0)
  const dIdle = idle - prevIdle
  const dTotal = total - prevTotal
  prevIdle = idle
  prevTotal = total
  if (dTotal <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)))
}
cpuPercent() // ilk örnek (prev'i doldur; ilk değerin 100% çıkmasını önler)

function meminfo(k: string): number {
  const mi = readFile("/proc/meminfo")
  const m = mi.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))
  return m ? Number(m[1]) : 0
}

// RAM — kullanılan GB (Total - Available).
export function ramUsed(): string {
  const used = (meminfo("MemTotal") - meminfo("MemAvailable")) / 1024 / 1024
  return `${used.toFixed(1)}G`
}

// RAM kullanım oranı 0..1.
export function ramFraction(): number {
  const total = meminfo("MemTotal")
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, (total - meminfo("MemAvailable")) / total))
}

// CPU sıcaklığı — k10temp hwmon'unu İSİMLE bul (index reboot'ta değişebilir).
function findTempPath(): string {
  for (let i = 0; i < 12; i++) {
    if (readFile(`/sys/class/hwmon/hwmon${i}/name`).trim() === "k10temp") {
      return `/sys/class/hwmon/hwmon${i}/temp1_input`
    }
  }
  return ""
}
const TEMP_PATH = findTempPath()
export function cpuTemp(): string {
  if (!TEMP_PATH) return ""
  const v = Number(readFile(TEMP_PATH).trim())
  return v ? `${Math.round(v / 1000)}°` : ""
}

// ─── Ağ throughput — /proc/net/dev rx/tx delta / geçen süre ──────
// Varsayılan rota arayüzünü /proc/net/route'tan bul (00000000 = default).
function defaultIface(): string {
  const route = readFile("/proc/net/route").split("\n")
  for (const line of route.slice(1)) {
    const f = line.trim().split(/\s+/)
    if (f.length > 1 && f[1] === "00000000") return f[0]
  }
  return ""
}
const NET_IFACE = defaultIface()

function ifaceBytes(): [number, number] {
  if (!NET_IFACE) return [0, 0]
  const m = readFile("/proc/net/dev").match(
    new RegExp(`^\\s*${NET_IFACE}:\\s*(\\d+)(?:\\s+\\d+){7}\\s+(\\d+)`, "m"),
  )
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}

// İnsan-okur hız: B/s → uygun birim.
function fmtRate(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B`
  const kb = bps / 1024
  if (kb < 1024) return `${Math.round(kb)} K`
  const mb = kb / 1024
  return mb < 100 ? `${mb.toFixed(1)} M` : `${Math.round(mb)} M`
}

let prevRx = 0
let prevTx = 0
let prevNetT = 0
// { down, up } anlık hız (B/s); monotonic time delta ile normalize.
export function netRates(): { down: string; up: string } {
  const now = GLib.get_monotonic_time() // µs
  const [rx, tx] = ifaceBytes()
  const dt = (now - prevNetT) / 1e6
  let down = 0
  let up = 0
  if (prevNetT > 0 && dt > 0) {
    down = Math.max(0, (rx - prevRx) / dt)
    up = Math.max(0, (tx - prevTx) / dt)
  }
  prevRx = rx
  prevTx = tx
  prevNetT = now
  return { down: fmtRate(down), up: fmtRate(up) }
}
netRates() // ilk örnek (prev'i doldur)

// ─── GPU — nvidia-smi csv çıktısını ayrıştır ─────────────────────
// nvidia-smi sysfs'te util vermez; tek çağrıda util/temp/mem alınır.
// GPU_QUERY'yi Bar/Dashboard createPoll(string) ile async çalıştırır.
export const GPU_QUERY =
  "nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits"

export function parseGpu(raw: string): {
  util: number
  temp: number
  memUsed: number
  memTotal: number
  memFrac: number
} {
  const f = raw.trim().split(",").map((x) => Number(x.trim()))
  if (f.length < 4 || f.some((n) => Number.isNaN(n))) {
    return { util: 0, temp: 0, memUsed: 0, memTotal: 0, memFrac: 0 }
  }
  const [util, temp, memUsed, memTotal] = f
  return { util, temp, memUsed, memTotal, memFrac: memTotal > 0 ? memUsed / memTotal : 0 }
}

// ─── Disk (btrfs) doluluk — scripts/disk.sh çıktısını ayrıştır ───
// disk.sh "mount|used|total" satırları döker (gerçek btrfs kullanımı).
const DISK_MOUNTS = ["/", "/home", "/mnt/data", "/mnt/depo"]
const DISK_LABELS: Record<string, string> = {
  "/": "Sistem",
  "/home": "Ev",
  "/mnt/data": "Data",
  "/mnt/depo": "Depo",
}
export const DISK_QUERY = `bash ${GLib.get_home_dir()}/.config/ags/scripts/disk.sh ${DISK_MOUNTS.join(" ")}`

// byte → okunur (G/T, 1 ondalık; <1G ise M).
function fmtSize(b: number): string {
  const g = b / 1024 ** 3
  if (g >= 1024) return `${(g / 1024).toFixed(1)}T`
  if (g >= 1) return `${g.toFixed(g >= 100 ? 0 : 1)}G`
  return `${Math.round(b / 1024 ** 2)}M`
}

export type DiskInfo = {
  mount: string
  label: string
  frac: number
  usedH: string
  totalH: string
}
export function parseDisks(raw: string): DiskInfo[] {
  const out: DiskInfo[] = []
  for (const line of raw.trim().split("\n")) {
    const [mount, usedS, totalS] = line.split("|")
    const used = Number(usedS)
    const total = Number(totalS)
    if (!mount || !total || Number.isNaN(used)) continue
    out.push({
      mount,
      label: DISK_LABELS[mount] || mount,
      frac: Math.max(0, Math.min(1, used / total)),
      usedH: fmtSize(used),
      totalH: fmtSize(total),
    })
  }
  return out
}

// ─── Hava durumu — wttr.in j1 JSON (scripts/weather-full.sh) ─────
export const WEATHER_QUERY = `bash ${GLib.get_home_dir()}/.config/ags/scripts/weather-full.sh`

// WWO weatherCode → { nerd-font ikon, Türkçe açıklama }.
function wx(code: string): { icon: string; tr: string } {
  const c = Number(code)
  if (c === 113) return { icon: "󰖙", tr: "Açık" }
  if (c === 116) return { icon: "󰖕", tr: "Az bulutlu" }
  if (c === 119 || c === 122) return { icon: "󰖐", tr: "Bulutlu" }
  if ([143, 248, 260].includes(c)) return { icon: "󰖑", tr: "Sisli" }
  if ([200, 386, 389].includes(c)) return { icon: "󰖓", tr: "Gök gürültülü" }
  if ([176, 263, 266, 293, 296, 353].includes(c)) return { icon: "󰖗", tr: "Hafif yağmur" }
  if ([299, 302, 305, 308, 356, 359].includes(c)) return { icon: "󰖖", tr: "Yağmurlu" }
  if ([182, 281, 284, 311, 314, 317, 350, 362, 365, 374, 377].includes(c))
    return { icon: "󰙿", tr: "Karla karışık" }
  if ([179, 227, 230, 320, 323, 326, 329, 332, 335, 338, 368, 371, 392, 395].includes(c))
    return { icon: "󰖘", tr: "Karlı" }
  return { icon: "󰖐", tr: "Bulutlu" }
}

const TR_DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]

export type WeatherNow = {
  temp: string
  feels: string
  icon: string
  desc: string
  humidity: string
  wind: string
}
export type WeatherDay = { day: string; icon: string; min: string; max: string; desc: string }
export type Weather = { now: WeatherNow; days: WeatherDay[]; sunrise: string; sunset: string } | null

export function parseWeather(raw: string): Weather {
  try {
    const d = JSON.parse(raw)
    const cc = d.current_condition?.[0]
    const wk = d.weather
    if (!cc || !Array.isArray(wk)) return null
    const w = wx(cc.weatherCode)
    const now: WeatherNow = {
      temp: `${cc.temp_C}°`,
      feels: `${cc.FeelsLikeC}°`,
      icon: w.icon,
      desc: w.tr,
      humidity: `${cc.humidity}%`,
      wind: `${cc.windspeedKmph} km/s ${cc.winddir16Point || ""}`.trim(),
    }
    const days: WeatherDay[] = wk.slice(0, 3).map((day: any, i: number) => {
      const mid = day.hourly?.[4] || day.hourly?.[0] || {}
      const dw = wx(mid.weatherCode)
      // date "YYYY-MM-DD" → Türkçe gün kısaltması (öğlen, TZ kayması yok).
      const parts = String(day.date).split("-").map(Number)
      const dow = new Date(parts[0], parts[1] - 1, parts[2], 12).getDay()
      return {
        day: i === 0 ? "Bugün" : TR_DAYS[dow],
        icon: dw.icon,
        min: `${day.mintempC}°`,
        max: `${day.maxtempC}°`,
        desc: dw.tr,
      }
    })
    const astro = wk[0]?.astronomy?.[0] || {}
    return { now, days, sunrise: astro.sunrise || "", sunset: astro.sunset || "" }
  } catch (e) {
    return null
  }
}

// Uptime — "3s 24d" gibi okunur biçim.
export function uptimePretty(): string {
  const secs = Number(readFile("/proc/uptime").split(" ")[0]) || 0
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h >= 24) {
    const d = Math.floor(h / 24)
    return `${d}g ${h % 24}s`
  }
  return `${h}s ${m}d`
}
