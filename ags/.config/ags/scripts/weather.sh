#!/usr/bin/env bash
# Hava durumu (wttr.in, IP konumundan). İnternet yoksa boş = modül gizlenir.
t=$(curl -s --max-time 5 "wttr.in/?format=%t" 2>/dev/null | tr -d '+')
[ -z "$t" ] && exit 0
echo "󰔏  $t"
