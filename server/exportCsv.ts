function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function createCsvDownload(payload: string) {
  const raw = JSON.parse(payload) as Array<Record<string, unknown>>;
  const headers = ["Nombre", "Teléfono", "Dirección", "Sitio web", "Rating", "Reseñas", "Estado"];
  const rows = raw.map(lead => [lead.name, lead.phone, lead.address, lead.website, lead.rating ?? "", lead.reviews, lead.status]);
  return [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
}
