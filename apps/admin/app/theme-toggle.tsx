"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("nursebridge-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("nursebridge-theme", next ? "dark" : "light");
  };

  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label={`Use ${dark ? "light" : "dark"} mode`}>
      <span aria-hidden="true">{dark ? "☀" : "◐"}</span>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
