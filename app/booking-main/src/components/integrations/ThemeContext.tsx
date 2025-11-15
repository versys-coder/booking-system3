import React from "react";

export interface ThemeVars {
  fontFamily: string;
  tabFontSize: number;
  tabColor: string;
  tabBgActive: string;
  tabColorActive: string;
  tabRadius: number;
  tabPaddingHorizontal: number;
  tabMinWidth: number;
  pageBg: string;
  // любые дополнительные переменные можно добавить здесь
}

export const ThemeContext = React.createContext<ThemeVars>({
  fontFamily: "'Segoe UI', Arial, sans-serif",
  tabFontSize: 20,
  tabColor: "#185a90",
  tabBgActive: "#185a90",
  tabColorActive: "#ffffff",
  tabRadius: 12,
  tabPaddingHorizontal: 26,
  tabMinWidth: 150,
  pageBg: "#f6fafd",
});