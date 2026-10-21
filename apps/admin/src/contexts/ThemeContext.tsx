import { createContext } from "react";

export const ThemeContext = createContext<{ appearance: "light" | "dark" }>({
  appearance: "dark",
});
