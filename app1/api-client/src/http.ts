import axios from "axios";

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "/";

export const http = axios.create({
  baseURL,
  timeout: 10000
});