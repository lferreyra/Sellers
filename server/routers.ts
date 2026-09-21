import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  makeRequest,
  type GeocodingResult,
  type PlaceDetailsResult,
  type PlacesSearchResult,
} from "./_core/map";
import { publicProcedure, router } from "./_core/trpc";

const searchInput = z.object({
  query: z.string().trim().min(2, "Escribe qué negocio estás buscando."),
  location: z.string().trim().min(2, "Indica una ciudad o zona."),
  limit: z.number().int().min(1).max(500).default(200),
});

type PlaceSummary = PlacesSearchResult["results"][number];

async function collectPlaces(query: string, location: string, limit: number) {
  const collected = new Map<string, PlaceSummary>();
  const addPlaces = (places: PlaceSummary[]) => {
    for (const place of places) {
      if (place.place_id) collected.set(place.place_id, place);
      if (collected.size >= limit) break;
    }
  };

  const firstPage = await makeRequest<PlacesSearchResult>(
    "/maps/api/place/textsearch/json",
    { query: `${query} en ${location}`, region: "cl" }
  );
  if (firstPage.status === "ZERO_RESULTS") return [];
  if (firstPage.status !== "OK") {
    throw new Error(`Google Places devolvió el estado ${firstPage.status}.`);
  }
  addPlaces(firstPage.results);

  // Google limits one Text Search to a small number of pages. Follow the
  // token when available, then use a geographic grid for larger requests.
  let nextPageToken = (firstPage as PlacesSearchResult & { next_page_token?: string }).next_page_token;
  for (let page = 1; page < 3 && nextPageToken && collected.size < limit; page += 1) {
    await new Promise(resolve => setTimeout(resolve, 2200));
    const pageResponse = await makeRequest<PlacesSearchResult & { next_page_token?: string }>(
      "/maps/api/place/textsearch/json",
      { pagetoken: nextPageToken }
    );
    if (pageResponse.status === "OK") addPlaces(pageResponse.results);
    nextPageToken = pageResponse.next_page_token;
  }

  if (collected.size < limit) {
    const geocode = await makeRequest<GeocodingResult>(
      "/maps/api/geocode/json",
      { address: location }
    );
    const center = geocode.results[0]?.geometry.location;
    if (center) {
      const targetCells = Math.min(25, Math.max(4, Math.ceil(limit / 12)));
      const side = Math.ceil(Math.sqrt(targetCells));
      const step = 0.025;
      const cells = Array.from({ length: side * side }, (_, index) => {
        const row = Math.floor(index / side) - (side - 1) / 2;
        const column = (index % side) - (side - 1) / 2;
        return `${center.lat + row * step},${center.lng + column * step}`;
      });
      const cellResponses = await Promise.all(
        cells.map(cell =>
          makeRequest<PlacesSearchResult>(
            "/maps/api/place/nearbysearch/json",
            { location: cell, radius: 1800, keyword: query }
          ).catch(() => null)
        )
      );
      for (const response of cellResponses) {
        if (response?.status === "OK") addPlaces(response.results);
        if (collected.size >= limit) break;
      }
    }
  }

  return Array.from(collected.values()).slice(0, limit);
}

async function enrichPlace(place: PlaceSummary) {
  try {
    const details = await makeRequest<PlaceDetailsResult>(
      "/maps/api/place/details/json",
      {
        place_id: place.place_id,
        fields:
          "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry",
      }
    );
    const detail = details.result;
    return {
      id: place.place_id,
      name: detail?.name ?? place.name,
      address: detail?.formatted_address ?? place.formatted_address,
      phone:
        detail?.formatted_phone_number ?? detail?.international_phone_number ?? "No publicado",
      website: detail?.website ?? "",
      rating: detail?.rating ?? place.rating ?? null,
      reviews: detail?.user_ratings_total ?? place.user_ratings_total ?? 0,
      lat: detail?.geometry?.location?.lat ?? place.geometry.location.lat,
      lng: detail?.geometry?.location?.lng ?? place.geometry.location.lng,
      status: place.business_status === "OPERATIONAL" ? "Activo" : "Verificar",
    };
  } catch {
    return {
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      phone: "No publicado",
      website: "",
      rating: place.rating ?? null,
      reviews: place.user_ratings_total ?? 0,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      status: place.business_status === "OPERATIONAL" ? "Activo" : "Verificar",
    };
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  places: router({
    search: publicProcedure.input(searchInput).mutation(async ({ input }) => {
      try {
        const places = await collectPlaces(input.query, input.location, input.limit);
        const results: Awaited<ReturnType<typeof enrichPlace>>[] = [];
        for (let index = 0; index < places.length; index += 8) {
          const batch = places.slice(index, index + 8);
          results.push(...(await Promise.all(batch.map(enrichPlace))));
        }

        return { results, source: "google" as const, requested: input.limit, collected: results.length };
      } catch (error) {
        console.error("[Places] Search failed", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Error de Google: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
