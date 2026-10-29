import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeMetaColor } from "@/components/theme/ThemeMetaColor";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem={false}
    enableColorScheme
    disableTransitionOnChange
    storageKey="picklebox-theme:v1"
  >
    <ThemeMetaColor />
    <App />
  </ThemeProvider>,
);
