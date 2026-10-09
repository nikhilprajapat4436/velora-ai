export const themePalettes = [
  { id: "royal-emerald", label: "Royal Emerald", mode: "dark", color: "#C6A15B", base: "#071C17", primary: "#0B3D32", soft: "#F3EBDD", mood: "Emerald · Gold · Warm ivory" },
  { id: "midnight-luxury", label: "Midnight Luxury", mode: "dark", color: "#D4B06A", base: "#0D0D0F", primary: "#202024", soft: "#E8DFD0", mood: "Midnight · Champagne · Cream" },
  { id: "royal-futuristic", label: "Royal Futuristic", mode: "dark", color: "#8B5CF6", base: "#24152F", primary: "#38204B", soft: "#F5F2EA", mood: "Plum · Violet · Soft white" },
  { id: "pearl-sage", label: "Pearl Sage", mode: "light", color: "#B08D57", base: "#FAF8F2", primary: "#0B3D32", soft: "#E8EDE5", mood: "Pearl · Emerald · Brass" },
  { id: "champagne-pearl", label: "Champagne Pearl", mode: "light", color: "#A77B36", base: "#FFFCF6", primary: "#F7F1E7", soft: "#F0E8DA", mood: "Warm ivory · Antique gold" },
  { id: "arctic-silver", label: "Arctic Silver", mode: "light", color: "#315B85", base: "#F5F8FC", primary: "#EAF0F7", soft: "#E3EAF3", mood: "Silver · Steel blue · Crisp" },
];

export const DEFAULT_THEME_PALETTE = "royal-emerald";

export function getSavedThemePalette() {
  try {
    const saved = localStorage.getItem("ai-assistant-accent");
    return themePalettes.some((palette) => palette.id === saved) ? saved : DEFAULT_THEME_PALETTE;
  } catch {
    return DEFAULT_THEME_PALETTE;
  }
}

export function applyThemePalette(paletteId) {
  const palette = themePalettes.find((option) => option.id === paletteId)
    || themePalettes.find((option) => option.id === DEFAULT_THEME_PALETTE);
  document.documentElement.dataset.accent = palette.id;
  document.documentElement.dataset.theme = palette.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette.base);
}
