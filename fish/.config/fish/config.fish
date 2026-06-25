source /usr/share/cachyos-fish-config/cachyos-config.fish

# overwrite greeting → fastfetch (Kurenai Sumi enso logosu, ~/.config/fastfetch)
function fish_greeting
    fastfetch
end

# ════════════════════════════════════════════════════════════
#  KURENAI SUMI — fish renkleri + pure prompt
#  bronz komut · crimson hata/operator · cream param · muted öneri
# ════════════════════════════════════════════════════════════
set -g fish_color_command       C9A34D       # komut → bronz
set -g fish_color_keyword       CF3A3A
set -g fish_color_param         D9CFC3       # parametre → ikincil krem
set -g fish_color_quote         6E8B5E       # string → sage
set -g fish_color_redirection   C9A34D
set -g fish_color_end           B71C1C
set -g fish_color_error         CF3A3A       # hata → crimson
set -g fish_color_comment       9E9388       # yorum → muted
set -g fish_color_operator      CF3A3A
set -g fish_color_escape        C9A34D
set -g fish_color_autosuggestion 6b6258      # öneri → soluk
set -g fish_color_cwd           C9A34D
set -g fish_color_cwd_root      B71C1C
set -g fish_color_valid_path    --underline
set -g fish_pager_color_prefix  C9A34D
set -g fish_pager_color_selected_background --background=B71C1C

# pure prompt (fish-pure-prompt) — Kurenai Sumi tonları
set -g pure_color_primary  F6EDE2
set -g pure_color_success  C9A34D       # prompt sembolü (başarı) → bronz
set -g pure_color_danger   CF3A3A       # (hata) → crimson
set -g pure_color_info     5B7E99
set -g pure_color_mute     9E9388
set -g pure_color_warning  C9A34D
set -g pure_color_normal   D9CFC3
