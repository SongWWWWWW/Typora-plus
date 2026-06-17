import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@typora-plus/theme/tokens.css";
import {
  WorkbenchApplication,
  createWorkbenchServices,
  type WorkbenchServices
} from "@typora-plus/workbench";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing root container");
}

const services = createWorkbenchServices();

if (new URLSearchParams(window.location.search).has("typoraPlusInstalledSmoke")) {
  (globalThis as typeof globalThis & {
    typoraPlusWorkbenchSmoke?: WorkbenchServices;
  }).typoraPlusWorkbenchSmoke = services;
}

createRoot(container).render(
  <StrictMode>
    <WorkbenchApplication services={services} />
  </StrictMode>
);
