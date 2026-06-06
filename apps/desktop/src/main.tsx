import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@typora-plus/theme/tokens.css";
import { WorkbenchApplication, createWorkbenchServices } from "@typora-plus/workbench";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing root container");
}

createRoot(container).render(
  <StrictMode>
    <WorkbenchApplication services={createWorkbenchServices()} />
  </StrictMode>
);
