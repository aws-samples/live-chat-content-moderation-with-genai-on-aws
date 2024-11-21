import React from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./styles/global.css";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
