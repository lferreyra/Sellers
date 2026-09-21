import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { makeRequest } from "./_core/map";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/map", async () => {
  const actual = await vi.importActual<typeof import("./_core/map")>("./_core/map");
  return { ...actual, makeRequest: vi.fn() };
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("places.search", () => {
  it("combines text search data with phone details", async () => {
    const mockedRequest = vi.mocked(makeRequest);
    mockedRequest
      .mockResolvedValueOnce({
        status: "OK",
        results: [
          {
            place_id: "place-1",
            name: "Café Prueba",
            formatted_address: "Av. Central 123",
            geometry: { location: { lat: -33.4, lng: -70.6 } },
            rating: 4.5,
            user_ratings_total: 12,
            business_status: "OPERATIONAL",
            types: ["cafe"],
          },
        ],
      })
      .mockResolvedValueOnce({
        status: "OK",
        result: {
          place_id: "place-1",
          name: "Café Prueba",
          formatted_address: "Av. Central 123",
          formatted_phone_number: "+56 2 2222 3333",
          website: "https://example.com",
          rating: 4.6,
          user_ratings_total: 15,
          geometry: { location: { lat: -33.4, lng: -70.6 } },
        },
      });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.places.search({
      query: "cafeterías",
      location: "Santiago",
      limit: 1,
    });

    expect(result.source).toBe("google");
    expect(result.results).toEqual([
      expect.objectContaining({
        id: "place-1",
        name: "Café Prueba",
        phone: "+56 2 2222 3333",
        website: "https://example.com",
        status: "Activo",
      }),
    ]);
  });
});
