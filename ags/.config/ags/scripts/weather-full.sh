#!/usr/bin/env bash
# wttr.in tam JSON (j1): anlık koşullar + 3 günlük tahmin + gün doğumu/batımı.
# İnternet yoksa boş çıkar → parser null döner, bölüm gizlenir.
curl -s --max-time 8 "wttr.in/?format=j1" 2>/dev/null
