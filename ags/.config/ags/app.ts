import app from "ags/gtk3/app"
import style from "./style/main.scss"
import Bar from "./widget/Bar"
import Desktop from "./widget/Desktop"
import Dashboard from "./widget/panels/Dashboard"
import AppGrid from "./widget/panels/AppGrid"
import InfoRail from "./widget/panels/InfoRail"
import Clipboard from "./widget/panels/Clipboard"
import PowerMenu from "./widget/panels/PowerMenu"
import Record from "./widget/panels/Record"
import Expose from "./widget/panels/Expose"
import RecordIndicator from "./widget/RecordIndicator"
import { handlePanelRequest } from "./lib/panels"

app.start({
  css: style,
  // Hyprland keybind'leri `ags request <panel>` ile panelleri toggle eder.
  requestHandler(request: unknown, res: (response: string) => void) {
    if (handlePanelRequest(request)) {
      res("ok")
      return
    }
    res("unknown request")
  },
  main() {
    // Bar her monitörde (hibrit topoloji içeride çözülüyor)
    app.get_monitors().map(Bar)
    // Masaüstü süsleri (cava + samuray) — yalnız primary'de
    app.get_monitors().map(Desktop)
    // Paneller: tekil global pencereler, aktif monitörde açılır
    Dashboard()
    AppGrid()
    InfoRail()
    Clipboard()
    PowerMenu()
    Record()
    Expose()
    // Yüzen kayıt göstergesi (kayıt sürerken görünür)
    RecordIndicator()
  },
})
