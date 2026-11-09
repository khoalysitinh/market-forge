// Tiny hash router: #/ , #/rooms/12 , #/trials/5 — no dependency needed.
export type Route = { name: "lobby" } | { name: "room"; id: number } | { name: "trial"; id: number };

export function parseHash(hash: string): Route {
  const m = hash.match(/^#\/(rooms|trials)\/(\d+)$/);
  if (m) return { name: m[1] === "rooms" ? "room" : "trial", id: Number(m[2]) };
  return { name: "lobby" };
}

export function navigate(path: string) {
  window.location.hash = path;
}
