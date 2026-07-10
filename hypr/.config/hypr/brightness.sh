#!/usr/bin/env bash
# Odaklı monitörün parlaklığını DDC/CI ile ayarla (Super+F5/F6).
# DDC I2C yazımı yavaş (~300ms+) → kasmasın diye:
#   - mevcut değer state dosyasından okunur (her basışta getvcp YOK)
#   - bildirim ANINDA gösterilir, ddcutil yazımı arkaplanda --noverify ile
#   - flock + dedup: hızlı basışlar kuyruk oluşturmaz, sadece SON değer yazılır
set -uo pipefail

dir="${1:?kullanım: brightness.sh up|down}"
step=5
statedir="$HOME/.cache/ddc-brightness"
mkdir -p "$statedir"

mon=$(hyprctl monitors -j | jq -r '.[] | select(.focused).name')

# DP-x → /dev/i2c-N eşlemesi yavaş (ddcutil detect ~1sn) → cache'le
cache="$HOME/.cache/ddc-bus-map"
if [[ ! -s $cache ]]; then
  ddcutil detect --brief 2>/dev/null \
    | awk '/I2C bus:/{bus=$3} /DRM connector:/{c=$3; sub(/^card[0-9]+-/,"",c); print c, bus}' > "$cache"
fi
bus=$(awk -v m="$mon" '$1==m{print $2}' "$cache")
bus=${bus##*/i2c-}
if [[ -z $bus ]]; then
  rm -f "$cache"
  notify-send -a Parlaklık "Parlaklık" "$mon için DDC bus bulunamadı" 2>/dev/null
  exit 1
fi

state="$statedir/$mon"
if [[ -s $state ]]; then
  cur=$(<"$state")
else
  cur=$(ddcutil --bus "$bus" getvcp 10 --brief | awk '{print $4}')
fi

if [[ $dir == up ]]; then new=$((cur + step)); else new=$((cur - step)); fi
(( new > 100 )) && new=100
(( new < 0 )) && new=0
echo "$new" > "$state"

# OSD hemen — donanıma yazım beklenmez
notify-send -a Parlaklık -e \
  -h int:value:"$new" -h string:x-canonical-private-synchronous:brightness \
  "Parlaklık" "$mon — %$new" 2>/dev/null

# Arkaplanda tek yazıcı: kuyruktaki her bekleyen kilidi alınca EN GÜNCEL değeri
# okur; zaten yazılmışsa hiç dokunmaz (dedup) → uzun basışta tek-iki yazım kalır.
(
  flock -x 9
  val=$(<"$state")
  applied="$statedir/$mon.applied"
  [[ -s $applied && $(<"$applied") == "$val" ]] && exit 0
  ddcutil --bus "$bus" setvcp 10 "$val" --noverify >/dev/null 2>&1 && echo "$val" > "$applied"
) 9>"$statedir/$mon.lock" &
