#!/bin/bash
# AGS başlatıcı — sass (~/.local/bin) PATH'te olsun diye.
export PATH="$HOME/.local/bin:$PATH"
exec ags run
