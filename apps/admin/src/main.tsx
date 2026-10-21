import { createI18n } from "@sakuio/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { BrowserRouter } from "react-router-dom";
import { ToastHost } from "@sakuio/ui";
import { Toaster } from "sonner";
import "@sakuio/ui/tokens.css";
import App from "./App";
import "./index.css";

const i18n = createI18n();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename="/admin">
        <App />
        <ToastHost />
        <Toaster theme="dark" richColors closeButton position="top-right" />
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>,
);
