import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import App from "./App";
import "./styles.css";
import "./game-screen.css";
import "./town-menu.css";
import "./town-ui.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
