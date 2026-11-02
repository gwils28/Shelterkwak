import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { store } from "./store/store";
import "./styles.css";

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
