# dotfiles

My Hyprland setup on CachyOS (Arch). Theme is a muted greige/"sumi" base with a
fixed red accent (#A84538), wallpaper-driven via matugen. Comments are mostly in
Turkish — sorry about that.

![screenshot](screenshots/desktop.png)

## What's in here

| | |
|---|---|
| WM | Hyprland (+ hypridle, hyprpaper) |
| Bar / panels / power menu | AGS (Astal, TypeScript/JSX) |
| Terminal | kitty |
| Launcher | rofi |
| Notifications | swaync |
| OSD (volume/brightness) | swayosd |
| Lock | gtklock → swaylock → hyprlock (fallback chain, see `hypr/lock.sh`) |
| Theming | matugen — `scheme-tonal-spot`, light, accent locked |
| GTK apps | adw-gtk3-dark + Papirus icons (`gtk-3.0`/`gtk-4.0`) |
| Shell | fish |
| Misc | fastfetch |

## Install

Uses GNU stow. Each top-level folder is one package.

```sh
sudo pacman -S stow
git clone <this-repo> ~/dotfiles
cd ~/dotfiles
stow */           # everything, or pick: stow hypr ags rofi fish ...
```

Stow symlinks each package into place under `~`, so editing a file in the repo
edits the live config and vice versa.

For AGS you'll need `aylurs-gtk-shell` and the Astal libs; the `@girs` types and
`node_modules` are gitignored and regenerated on first run.

## Theming

Drop a wallpaper in `~/Pictures/Wallpapers` and run:

```sh
~/.config/matugen/retheme.sh path/to/wallpaper.png
```

It regenerates colors for hypr, hyprlock and rofi from the image, keeps the red
accent, and reloads. The default is `samurai.png`. (AGS and swaync use their own
static stylesheets, not matugen.)

## Dependencies for theming

GTK app theming expects these installed (not bundled): `adw-gtk3`,
`papirus-icon-theme`, and the Breeze cursors / Breeze GTK theme (`breeze`,
`breeze-gtk`) — `gtk-4.0/gtk-dark.css` symlinks into `/usr/share/themes/Breeze`.

Qt apps are themed through the KDE platform theme (`QT_QPA_PLATFORMTHEME=kde`,
widget style Breeze + a `KurenaiSumi` color scheme). That layer lives in KDE
config outside `~/.config`, so it isn't shipped here — Qt apps just won't match
the palette out of the box.

## Notes

- Wallpapers in `wallpapers/` are large; swap in your own if you want.
- swaylock and gtklock don't expand env vars, so their background/style paths in
  `swaylock/.config/swaylock/config` and `gtklock/.config/gtklock/config.ini`
  are written as `$HOME/...` placeholders — edit them to your real home if you
  use those locks. (gtklock is the primary lock.)
- Monitors are set in `hypr/monitors.conf` for a 3-monitor layout — adjust to
  yours.
