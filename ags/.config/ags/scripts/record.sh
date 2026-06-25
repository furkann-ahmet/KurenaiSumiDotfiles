#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  gpu-screen-recorder sarmalayıcı (NVENC) — başlat / durdur / durum.
#  Durum dosyaları XDG_RUNTIME_DIR'de: gsr.pid (PID) + gsr.start (epoch).
#  Kayıt klasörü: ~/Videos/Kayitlar/
#  Kullanım:
#    record.sh start <full|region> <mic:0|1> <sys:0|1>
#    record.sh stop
#    record.sh status   → "idle"  veya  "rec <başlangıç_epoch>"
# ════════════════════════════════════════════════════════════════
RT="${XDG_RUNTIME_DIR:-/tmp}"
PIDF="$RT/gsr.pid"
STARTF="$RT/gsr.start"
OUTDIR="$HOME/Videos/Kayitlar"
LOG="$RT/gsr.log"

is_running() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF" 2>/dev/null)" 2>/dev/null; }

case "$1" in
  status)
    if is_running; then echo "rec $(cat "$STARTF" 2>/dev/null || echo 0)"; else echo "idle"; fi
    ;;

  stop)
    if is_running; then
      # SIGINT → gsr mp4'ü düzgün finalize eder (moov atom yazılır).
      kill -SIGINT "$(cat "$PIDF")" 2>/dev/null
      for _ in 1 2 3 4 5 6 7 8 9 10; do is_running || break; sleep 0.3; done
    fi
    rm -f "$PIDF" "$STARTF"
    notify-send -a "Ekran Kaydı" "Kayıt durduruldu" "Kaydedildi: $OUTDIR" 2>/dev/null
    ;;

  start)
    is_running && exit 0
    mode="${2:-full}"; mic="${3:-0}"; sys="${4:-1}"
    mkdir -p "$OUTDIR"
    out="$OUTDIR/kayit_$(date +%Y%m%d_%H%M%S).mp4"

    # ─ Yakalama hedefi ─
    if [ "$mode" = "region" ]; then
      geo=$(slurp 2>/dev/null) || exit 1          # "X,Y WxH"
      [ -z "$geo" ] && exit 1                       # iptal edildi
      xy="${geo%% *}"; wh="${geo##* }"
      x="${xy%,*}"; y="${xy#*,}"; w="${wh%x*}"; h="${wh#*x}"
      mon=$(hyprctl -j cursorpos >/dev/null 2>&1; hyprctl -j activeworkspace | jq -r '.monitor')
      target=(-w "$mon" -region "${w}x${h}+${x}+${y}")
    else
      # "Tüm ekran" = odaktaki monitör (3 monitörde hepsini birden değil).
      mon=$(hyprctl -j activeworkspace | jq -r '.monitor')
      target=(-w "$mon")
    fi

    # ─ Ses ─ sistem + mikrofon tek track'e karışsın (oynatıcı uyumu).
    devs=""
    if [ "$sys" = "1" ]; then
      sink=$(pactl get-default-sink 2>/dev/null)
      [ -n "$sink" ] && devs="${sink}.monitor"
    fi
    if [ "$mic" = "1" ]; then
      src=$(pactl get-default-source 2>/dev/null)
      [ -n "$src" ] && { [ -n "$devs" ] && devs="${devs}|${src}" || devs="$src"; }
    fi
    audio=()
    [ -n "$devs" ] && audio=(-a "$devs")

    # NVENC h264, 60fps, yüksek kalite. nohup → AGS script'i bitse de yaşar.
    nohup gpu-screen-recorder "${target[@]}" -f 60 -q very_high -k h264 \
      "${audio[@]}" -o "$out" >"$LOG" 2>&1 &
    pid=$!
    echo "$pid" > "$PIDF"
    date +%s > "$STARTF"
    # gsr hemen düşerse (hatalı arg) durum dosyalarını temizle.
    sleep 0.6
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PIDF" "$STARTF"
      notify-send -a "Ekran Kaydı" "Kayıt başlatılamadı" "$(tail -3 "$LOG" 2>/dev/null)" 2>/dev/null
      exit 1
    fi
    notify-send -a "Ekran Kaydı" "Kayıt başladı" "$(basename "$out")" 2>/dev/null
    ;;

  *)
    echo "kullanım: record.sh start|stop|status" >&2
    exit 2
    ;;
esac
