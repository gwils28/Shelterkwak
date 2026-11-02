import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { store } from "./store/store";
import "./styles.css";

// Service worker : l'app et le catalogue restent disponibles sans réseau ; mise à jour automatique.
registerSW({ immediate: true });

const root = createRoot(document.getElementById("root")!);

store
  .init()
  .then(() => {
    // Demande à Android de ne pas effacer les données de l'app en cas de manque d'espace.
    void navigator.storage?.persist?.();
    store.startAutoSync();
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((e: Error) => {
    root.render(<div className="splash error">Stockage local indisponible sur ce navigateur : {e.message}</div>);
  });
