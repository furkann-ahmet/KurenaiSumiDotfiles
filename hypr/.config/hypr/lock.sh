#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  KURENAI SUMI — kilit başlatıcı
#  Sıra: gtklock (GTK3, CSS tema, on-demand render → NVIDIA takılması YOK)
#        → swaylock (yedek)  → hyprlock (son çare).
#  hyprlock sürekli ~59fps render edip NVIDIA present'iyle takılıyordu; gtklock
#  ve swaylock kilidi sürekli render etmez, bu yüzden hızlı/pürüzsüz.
# ════════════════════════════════════════════════════════════════
# Kilitlenirken çalan medyayı duraklat (spotify/mpv/tarayıcı — hepsi)
playerctl -a pause 2>/dev/null

if command -v gtklock >/dev/null 2>&1; then
  exec gtklock                      # ~/.config/gtklock/config.ini'i otomatik okur
elif command -v swaylock >/dev/null 2>&1; then
  exec swaylock
else
  exec hyprlock                     # fallback
fi
