import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

/* Стили из app для 1:1 */
import "./BookingVariant1.css";
import "./poolBooking.css";
import "./Heatmap.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);