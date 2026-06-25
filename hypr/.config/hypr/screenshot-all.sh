#!/usr/bin/env bash
# Tüm monitörleri tek karede yakala → kaydet + panoya kopyala (Shift+Print).
# hyprshot tek monitör alır; grim (çıkışsız) tüm düzeni birleştirir.
set -o pipefail

dir="${HYPRSHOT_DIR:-$HOME/Resimler}"
mkdir -p "$dir"
file="$dir/$(date +%Y-%m-%d-%H%M%S)_hyprshot.png"

if grim "$file"; then
  wl-copy --type image/png < "$file"
  notify-send -a Hyprshot "Ekran görüntüsü" "Tüm monitörler kaydedildi ve panoya kopyalandı" -i "$file" 2>/dev/null
else
  notify-send -a Hyprshot "Ekran görüntüsü" "Yakalama başarısız" 2>/dev/null
  exit 1
fi
