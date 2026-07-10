#!/usr/bin/env bash
# Tüm sistemi wallpaper renklerinden yeniden temalar.
# Kullanım: retheme.sh [wallpaper-yolu]   (varsayılan: ana ekran samurai.png)
# Sabit kırmızı aksan (#A84538) şablonlarda korunur; sadece taban renkleri değişir.
set -e
WALL="${1:-$HOME/Pictures/Wallpapers/samurai.png}"

# Kilit ekranı arka planını tema kaynağına bağla (hyprlock buradan okur)
ln -sf "$WALL" "$HOME/.config/hypr/current-wallpaper"

matugen image "$WALL" -m light -t scheme-tonal-spot --prefer saturation

# Reload'lar
hyprctl reload >/dev/null 2>&1 || true
killall dunst  2>/dev/null || true; sleep 0.3; (dunst  >/dev/null 2>&1 &)
# AGS bar: kendi style.css'i (matugen döngüsünde değil — ayrıca bağlanabilir)
# alacritty: live_config_reload açık (anında) · rofi: sonraki açılışta · hyprlock: sonraki kilitte

echo "✅ Tema güncellendi — kaynak: $WALL"
