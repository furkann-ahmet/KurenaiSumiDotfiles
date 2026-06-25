#!/usr/bin/env bash
# Bekleyen güncelleme sayıları → "resmi|aur".
# checkupdates: geçici db'ye senkron (sudosuz). paru -Qua: AUR sorgusu.
# İnternet yoksa 0|0 döner (modül gizlenir).
off=$(checkupdates 2>/dev/null | wc -l)
aur=$(paru -Qua 2>/dev/null | wc -l)
echo "${off}|${aur}"
