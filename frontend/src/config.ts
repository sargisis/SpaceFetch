/**
 * Resolves the absolute backend API URL or relative path based on the current origin.
 * In Vite development mode (usually port 5173), it falls back to the localhost:8080 Go API server.
 * In production/unified deployment, it uses a relative path so the browser targets the same host.
 */
export const getApiUrl = (path: string): string => {
  const origin = window.location.origin;
  if (origin.includes(':5173')) {
    return `http://localhost:8080${path}`;
  }
  return path;
};
