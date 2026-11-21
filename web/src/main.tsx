// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { DisplayPrefsProvider, ToastProvider } from "@junctura/health-ui";
import "@junctura/health-ui/fonts.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// MyHealth is read by many older people: start with large text unless the person already chose a size.
try { if (!localStorage.getItem("junctura.display")) localStorage.setItem("junctura.display", JSON.stringify({ textSize: "lg" })); } catch { /* storage unavailable: the default size applies */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DisplayPrefsProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </DisplayPrefsProvider>
  </StrictMode>,
);
