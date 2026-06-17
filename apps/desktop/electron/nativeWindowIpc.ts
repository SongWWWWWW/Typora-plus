import { BrowserWindow, ipcMain } from "electron";

export const nativeWindowIpcChannels = {
  setTitleBarTheme: "typora-plus:window:setTitleBarTheme"
} as const;

type NativeWindowTitleBarTheme = "light" | "dark";

const nativeWindowTitleBarOverlayByTheme = {
  light: {
    color: "#f8f7f2",
    symbolColor: "#676d62",
    height: 38
  },
  dark: {
    color: "#181916",
    symbolColor: "#c8d0c2",
    height: 38
  }
} as const satisfies Record<NativeWindowTitleBarTheme, Electron.TitleBarOverlay>;

export function registerNativeWindowIpc(): void {
  ipcMain.handle(nativeWindowIpcChannels.setTitleBarTheme, (event, theme: unknown) => {
    if (!isNativeWindowTitleBarTheme(theme)) {
      throw new Error("Window title bar theme is invalid");
    }

    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return false;
    }

    window.setTitleBarOverlay(nativeWindowTitleBarOverlayByTheme[theme]);
    return true;
  });
}

function isNativeWindowTitleBarTheme(value: unknown): value is NativeWindowTitleBarTheme {
  return value === "light" || value === "dark";
}
