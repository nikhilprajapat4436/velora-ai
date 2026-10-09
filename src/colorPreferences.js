export const COLOR_PREFERENCES_KEY = "ai-assistant-interface-colors";

export const DEFAULT_INTERFACE_COLORS = {
  text: "#edf0f7",
  container: "#141a24",
};

const isHexColor = (value) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

export function readInterfaceColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLOR_PREFERENCES_KEY) || "{}");
    return {
      text: isHexColor(saved.text) ? saved.text : DEFAULT_INTERFACE_COLORS.text,
      container: isHexColor(saved.container) ? saved.container : DEFAULT_INTERFACE_COLORS.container,
    };
  } catch {
    return { ...DEFAULT_INTERFACE_COLORS };
  }
}

export function applyInterfaceColors(colors = DEFAULT_INTERFACE_COLORS) {
  const root = document.documentElement;
  const text = isHexColor(colors.text) ? colors.text : DEFAULT_INTERFACE_COLORS.text;
  const container = isHexColor(colors.container) ? colors.container : DEFAULT_INTERFACE_COLORS.container;

  root.style.setProperty("--app-custom-text", text);
  root.style.setProperty("--app-custom-container", container);
  root.style.setProperty("--app-custom-raised", `color-mix(in srgb, ${container} 86%, ${text})`);
  root.style.setProperty("--app-custom-text-secondary", `color-mix(in srgb, ${text} 78%, var(--app-bg))`);
  root.style.setProperty("--app-custom-muted", `color-mix(in srgb, ${text} 56%, var(--app-bg))`);
}

export function clearInterfaceColors() {
  document.documentElement.style.removeProperty("--app-custom-text");
  document.documentElement.style.removeProperty("--app-custom-container");
  document.documentElement.style.removeProperty("--app-custom-raised");
  document.documentElement.style.removeProperty("--app-custom-text-secondary");
  document.documentElement.style.removeProperty("--app-custom-muted");
}
