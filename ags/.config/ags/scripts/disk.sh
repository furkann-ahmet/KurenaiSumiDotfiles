#!/bin/bash
# Her btrfs bağlama noktası için "mount|kullanılan_byte|toplam_byte" satırı verir.
# btrfs fi usage -b: sudosuz da Overall { Device size, Used } byte değerlerini
# verir (sadece per-device chunk detayı root ister) → gerçek doluluk buradan.
# Kullanım: disk.sh / /home /mnt/data /mnt/depo
for m in "$@"; do
  out=$(btrfs filesystem usage -b "$m" 2>/dev/null)
  [ -z "$out" ] && continue
  total=$(echo "$out" | awk '/Device size:/ {print $3; exit}')
  used=$(echo "$out" | awk '/^[[:space:]]*Used:/ {print $2; exit}')
  [ -z "$total" ] && continue
  echo "$m|${used:-0}|$total"
done
