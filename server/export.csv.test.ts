import { describe, expect, it } from "vitest";
import { createCsvDownload } from "./exportCsv";

describe("export CSV", () => {
  it("genera una tabla CSV válida con cabeceras y valores escapados", () => {
    const csv = createCsvDownload(JSON.stringify([
      {
        name: "Café \"Central\"",
        phone: "+54 11 5555 0000",
        address: "Av. Siempre Viva 123",
        website: "https://example.com",
        rating: 4.8,
        reviews: 12,
        status: "Activo",
      },
    ]));

    expect(csv.split("\r\n")).toEqual([
      '"Nombre","Teléfono","Dirección","Sitio web","Rating","Reseñas","Estado"',
      '"Café ""Central""","+54 11 5555 0000","Av. Siempre Viva 123","https://example.com","4.8","12","Activo"',
    ]);
  });
});

it("rechaza payloads que no contienen JSON válido", () => {
  expect(() => createCsvDownload("no-json")).toThrow();
});
