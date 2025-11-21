import React from "react";
import { createRoot } from "react-dom/client";
import PayTest from "./PayTest";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <div style={{ padding: 12 }}>
      <PayTest />
    </div>
  </React.StrictMode>
);