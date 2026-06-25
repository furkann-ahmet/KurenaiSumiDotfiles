# dotfiles

my hyprland setup on cachyos, 3 monitors. theme is a muted greige base with one
red accent (#A84538) — base colors follow the wallpaper through matugen, the red
stays fixed. config comments are in turkish, sorry.

## what's running

- **wm** — hyprland (+ hypridle, hyprpaper)
- **bar / panels / power menu / app grid** — ags (astal, ts+jsx)
- **terminal** kitty · **launcher** rofi · **notifications** swaync
- **lock** — gtklock, falls back to swaylock then hyprlock (`hypr/lock.sh`)
- **shell** — fish, fastfetch on greeting
- **gtk** — adw-gtk3-dark + papirus

## install

it's stow, each top folder is one package:

```
git clone <repo> ~/dotfiles && cd ~/dotfiles
stow */          # or pick: stow hypr ags fish rofi
```

stuff to know:

- ags pulls its `@girs` types and `node_modules` on first run, those are ignored
- install `adw-gtk3`, `papirus-icon-theme`, `breeze`/`breeze-gtk` or gtk apps
  look off (gtk-4.0 symlinks into the system Breeze theme)
- qt apps go through the kde platform theme — i didn't ship that part, so they
  won't match the palette
- swaylock/gtklock don't expand env vars, so the bg/style paths in their configs
  are left as `$HOME/...` — edit them to your home if you use those
- `hypr/monitors.conf` is my 3-monitor layout, change it for yours

## theming

drop a wallpaper in `~/Pictures/Wallpapers` and run:

```
~/.config/matugen/retheme.sh path/to/wallpaper.png
```

it rebuilds hypr/hyprlock/rofi colors from the image, keeps the red accent and
reloads. ags and swaync use their own static stylesheets so they don't follow.
