import { createRoot } from "react-dom/client";
import { tg } from "./tg";
import { StoreProvider } from "./store";
import App from "./App";
import "./styles.css";

tg?.ready();
tg?.expand();

const dark = tg?.colorScheme !== "light";
document.documentElement.dataset.theme = dark ? "dark" : "light";
try {
  const c = dark ? "#0B0B0C" : "#E9EAEC";
  tg.setHeaderColor(c);
  tg.setBackgroundColor(c);
} catch {}

createRoot(document.getElementById("app")).render(
  <StoreProvider>
    <App />
  </StoreProvider>
);
