const FLOOR_RE = /^(floor|piętro)\s+(\d+)$/iu;

const RESOURCE_LABELS: Record<string, string> = {
  TV: "Telewizor",
  Whiteboard: "Tablica suchościeralna",
  "Hybrid Kit": "Zestaw hybrydowy",
  "Focus Booth": "Kabina skupienia",
  Stage: "Scena",
  Projector: "Projektor"
};

export function normalizeRoomLocation(location: string) {
  const trimmed = location.trim();
  const match = FLOOR_RE.exec(trimmed);
  if (match) {
    return `Piętro ${match[2]}`;
  }
  return trimmed;
}

export function formatRoomLocation(location: string) {
  return normalizeRoomLocation(location);
}

export function formatRoomResource(resource: string) {
  return RESOURCE_LABELS[resource] ?? resource;
}
