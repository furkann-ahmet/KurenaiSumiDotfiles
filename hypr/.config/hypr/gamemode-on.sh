#!/usr/bin/env bash
# gamemode başlayınca: compositor süslerini kapat, GPU'yu oyuna bırak.
# (gamemode.ini [custom] start buraya bağlı)
hyprctl --batch "keyword animations:enabled 0; keyword decoration:blur:enabled 0; keyword decoration:shadow:enabled 0" >/dev/null
