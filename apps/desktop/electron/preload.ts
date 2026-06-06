import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("typoraPlus", {
  platform: process.platform
});
