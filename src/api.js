const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
  configuredApiUrl || (import.meta.env.PROD ? "" : "http://localhost:5000")
).replace(/\/+$/, "");

export const apiUrl = (path) =>
  API_BASE_URL + (path.startsWith("/") ? "" : "/") + path;
