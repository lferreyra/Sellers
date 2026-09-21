import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Store,
  Target,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviews: number;
  lat: number;
  lng: number;
  status: string;
};

const DEMO_LEADS: Lead[] = [
  { id: "demo-1", name: "Café Altura", address: "Av. Providencia 1234, Santiago", phone: "+56 2 2345 6789", website: "https://cafealtura.cl", rating: 4.8, reviews: 318, lat: -33.425, lng: -70.611, status: "Activo" },
  { id: "demo-2", name: "Taller Norte", address: "Manuel Montt 845, Providencia", phone: "+56 9 8765 4321", website: "", rating: 4.6, reviews: 94, lat: -33.431, lng: -70.618, status: "Activo" },
  { id: "demo-3", name: "La Bodega Verde", address: "Av. Italia 1610, Ñuñoa", phone: "+56 2 2987 1132", website: "https://labodegaverde.cl", rating: 4.7, reviews: 186, lat: -33.452, lng: -70.601, status: "Activo" },
  { id: "demo-4", name: "Estudio Marea", address: "Av. Santa Isabel 550, Santiago", phone: "No publicado", website: "https://estudiomarea.com", rating: 4.4, reviews: 61, lat: -33.447, lng: -70.635, status: "Verificar" },
  { id: "demo-5", name: "Panadería La Esquina", address: "Av. Irarrázaval 2330, Ñuñoa", phone: "+56 9 7123 9088", website: "", rating: 4.9, reviews: 427, lat: -33.454, lng: -70.596, status: "Activo" },
];

const LOCATION_PRESETS = [
  { label: "Buenos Aires", value: "Buenos Aires, Argentina" },
  { label: "Rosario", value: "Rosario, Santa Fe, Argentina" },
  { label: "Córdoba", value: "Córdoba, Argentina" },
];

export default function Home() {
  const [query, setQuery] = useState("cafeterías");
  const [location, setLocation] = useState("Santiago, Chile");
  const [resultLimit, setResultLimit] = useState(200);
  const [results, setResults] = useState<Lead[]>(DEMO_LEADS);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEMO_LEADS.map(lead => lead.id));
  const [source, setSource] = useState<"demo" | "google">("demo");
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const searchMutation = trpc.places.search.useMutation({
    onSuccess: data => {
      const nextResults = data.results as Lead[];
      setResults(nextResults);
      setSelectedIds(nextResults.map(lead => lead.id));
      setSource("google");
      setSearchElapsedMs(searchStartedAt ? Date.now() - searchStartedAt : 0);
      if (data.results.length === 0) toast.info("No encontramos comercios con esos filtros.");
      else toast.success(`${data.results.length} comercios encontrados${data.results.length < resultLimit ? ` de ${resultLimit} solicitados` : ""}.`);
    },
    onError: error => {
      setSearchElapsedMs(searchStartedAt ? Date.now() - searchStartedAt : 0);
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!searchMutation.isPending || !searchStartedAt) return;
    const timer = window.setInterval(() => {
      setSearchElapsedMs(Date.now() - searchStartedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [searchMutation.isPending, searchStartedAt]);

  const selectedLeads = useMemo(
    () => results.filter(lead => selectedIds.includes(lead.id)),
    [results, selectedIds]
  );
  const phoneCount = results.filter(lead => lead.phone !== "No publicado").length;
  const allSelected = results.length > 0 && selectedIds.length === results.length;

  useEffect(() => {
    if (!map || !window.google?.maps?.marker) return;
    markers.current.forEach(marker => (marker.map = null));
    markers.current = results.map(lead => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: lead.lat, lng: lead.lng },
        title: lead.name,
      });
      return marker;
    });
    if (results[0]) map.panTo({ lat: results[0].lat, lng: results[0].lng });
    return () => markers.current.forEach(marker => (marker.map = null));
  }, [map, results]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !location.trim()) return;
    setSearchStartedAt(Date.now());
    setSearchElapsedMs(0);
    searchMutation.mutate({ query, location, limit: resultLimit });
  };

  const isSearching = searchMutation.isPending;
  const elapsedSeconds = (searchElapsedMs / 1000).toFixed(1);

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : results.map(lead => lead.id));
  };

  const toggleLead = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const showSample = () => {
    setResults(DEMO_LEADS);
    setSelectedIds(DEMO_LEADS.map(lead => lead.id));
    setSource("demo");
    setSearchElapsedMs(0);
    toast.success("Muestra cargada: 5 comercios listos para exportar.");
  };

  return (
    <div className="min-h-screen text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/85 px-6 py-4 backdrop-blur-xl lg:px-10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight">Descubrimiento local</h1>
                <Badge className="hidden rounded-full border-0 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-flex">Beta</Badge>
              </div>
              <p className="text-xs text-slate-500">Encuentra negocios, valida teléfonos y crea tu próxima lista.</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-400 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Fuente oficial: Google Places
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-8">
        <section className="mb-6 overflow-hidden rounded-[28px] bg-slate-950 px-6 py-7 text-white shadow-2xl shadow-slate-900/10 lg:px-9 lg:py-9">
          <div className="hero-grid absolute" aria-hidden="true" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" /> Prospección sin ruido
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Convierte una zona en una lista de oportunidades.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">Busca por categoría y ciudad. MapaLeads reúne nombre, teléfono, dirección y presencia web para que puedas decidir a quién contactar.</p>
            </div>
            <form onSubmit={handleSearch} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur sm:grid-cols-2">
              <label className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-sky-400 sm:col-span-1">
                <Search className="h-4 w-4 shrink-0" />
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ej. dentistas" aria-label="Categoría o tipo de comercio" className="h-11 min-w-0 border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none focus-visible:ring-0" />
              </label>
              <label className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-sky-400 sm:col-span-1">
                <MapPin className="h-4 w-4 shrink-0" />
                <Input value={location} onChange={event => setLocation(event.target.value)} placeholder="Ciudad o comuna" aria-label="Ciudad o zona" className="h-11 min-w-0 border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none focus-visible:ring-0" />
              </label>
              <label className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-slate-500 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-sky-400 sm:col-span-1">
                <Users className="h-4 w-4 shrink-0" />
                <select value={resultLimit} onChange={event => setResultLimit(Number(event.target.value))} className="h-11 min-w-[92px] border-0 bg-transparent text-sm font-semibold text-slate-700 outline-none">
                  <option value={200}>200 leads</option>
                  <option value={300}>300 leads</option>
                  <option value={500}>500 leads</option>
                </select>
              </label>
              <Button type="submit" disabled={searchMutation.isPending} className="h-11 rounded-xl bg-sky-400 px-5 font-bold text-slate-950 hover:bg-sky-300 sm:col-span-1">
                {searchMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Buscar
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="mr-1 text-slate-400">Ubicación rápida:</span>
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setLocation(preset.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-semibold transition",
                    location === preset.value
                      ? "border-sky-300 bg-sky-300 text-slate-950"
                      : "border-white/15 bg-white/10 text-slate-200 hover:border-sky-300/70 hover:bg-sky-300/15 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-4 min-h-8">
              {isSearching ? (
                <div className="flex items-center gap-3 text-xs font-medium text-sky-200">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Buscando comercios y teléfonos… {elapsedSeconds}s</span>
                  <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="progress-sweep h-full w-1/3 rounded-full bg-sky-300" />
                  </div>
                </div>
              ) : searchElapsedMs > 0 ? (
                <p className="text-xs text-slate-400">Última búsqueda completada en {elapsedSeconds}s.</p>
              ) : null}
            </div>
          </div>
          <div className="relative z-10 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Nombres verificados</span>
            <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Teléfonos públicos</span>
            <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Exportación CSV</span>
          </div>
        </section>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Resultados", value: results.length, icon: Store, accent: "bg-sky-50 text-sky-700" },
            { label: "Con teléfono", value: phoneCount, icon: Phone, accent: "bg-emerald-50 text-emerald-700" },
            { label: "Seleccionados", value: selectedIds.length, icon: Users, accent: "bg-amber-50 text-amber-700" },
          ].map(stat => (
            <Card key={stat.label} className="rounded-2xl border-0 bg-white shadow-sm shadow-slate-900/[0.04]">
              <CardContent className="flex items-center justify-between p-5">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{stat.label}</p><p className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p></div>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", stat.accent)}><stat.icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="min-w-0 rounded-2xl border-0 bg-white shadow-sm shadow-slate-900/[0.04]">
            <form method="post" action="/api/export/csv" onSubmit={event => { 
              if (selectedLeads.length === 0) { 
                event.preventDefault(); 
                toast.info("Selecciona al menos un comercio para descargar el CSV."); 
              } else { 
                toast.success(`Descargando CSV con ${selectedLeads.length} comercios.`); 
              } 
            }}>
              <input type="hidden" name="payload" value={JSON.stringify(selectedLeads)} />
              
              <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="flex items-center gap-2"><h3 className="font-display text-lg font-bold tracking-tight">Resultados encontrados</h3><Badge variant="secondary" className="rounded-full bg-slate-100 text-xs font-bold text-slate-600">{source === "demo" ? "Muestra" : "Google"}</Badge></div><p className="mt-1 text-sm text-slate-500">Selecciona los contactos que quieres llevar a tu CRM.</p></div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={showSample} className="rounded-lg border-slate-200 text-slate-600">Ver muestra</Button>
                    <button type="submit" disabled={selectedLeads.length === 0} className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-all", selectedLeads.length > 0 ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-400")}>
                      <Download className="h-4 w-4" /> Exportar CSV
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 text-xs font-semibold text-slate-400 sm:px-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="sr-only" checked={allSelected} onChange={toggleAll} />
                    <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border transition group-hover:border-sky-400", allSelected ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 bg-white")}>
                      {allSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <span>{selectedIds.length ? `${selectedIds.length} seleccionados` : "Seleccionar todos"}</span>
                  </label>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-500 ml-2">Objetivo: {resultLimit}</span>
                  {selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} className="ml-auto flex items-center gap-1 text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /> Limpiar</button>}
                </div>
                <div className="divide-y divide-slate-100">
                  {results.map(lead => (
                    <label key={lead.id} className={cn("group grid cursor-pointer gap-4 px-5 py-4 transition hover:bg-slate-50/80 focus-within:ring-2 focus-within:ring-inset focus-within:ring-sky-400 sm:grid-cols-[auto_minmax(0,1fr)_190px_auto] sm:items-center sm:px-6", selectedIds.includes(lead.id) && "bg-sky-50/35")}>
                      <div className="flex items-center">
                        <input type="checkbox" className="sr-only" checked={selectedIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} />
                        <div className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition group-hover:scale-105 sm:mt-0", selectedIds.includes(lead.id) ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 bg-white group-hover:border-sky-400")}>
                          {selectedIds.includes(lead.id) && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                      <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-slate-800">{lead.name}</p><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", lead.status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{lead.status}</span></div><p className="mt-1 flex items-start gap-1 text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{lead.address}</p></div>
                      <div className="space-y-1 text-xs sm:border-l sm:border-slate-100 sm:pl-4"><p className="flex items-center gap-2 font-semibold text-slate-700"><Phone className="h-3.5 w-3.5 text-sky-600" />{lead.phone}</p><p className="text-slate-400">{lead.rating ? `★ ${lead.rating} · ${lead.reviews} reseñas` : "Sin rating visible"}</p></div>
                      <div className="flex justify-end">{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-sky-600" aria-label={`Abrir sitio de ${lead.name}`}><ExternalLink className="h-4 w-4" /></a> : <span className="text-xs text-slate-300">—</span>}</div>
                    </label>
                  ))}
                  {results.length === 0 && <div className="px-6 py-16 text-center"><Store className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">No hay resultados todavía</p><p className="mt-1 text-sm text-slate-400">Prueba con otra categoría o ubicación.</p></div>}
                </div>
              </CardContent>
            </form>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-sm shadow-slate-900/[0.04]">
            <CardHeader className="border-b border-slate-100 px-5 py-5"><div className="flex items-center justify-between"><div><h3 className="font-display text-lg font-bold tracking-tight">Vista de zona</h3><p className="mt-1 text-sm text-slate-500">Distribución de tus oportunidades</p></div><div className="rounded-lg bg-sky-50 p-2 text-sky-700"><MapPin className="h-4 w-4" /></div></div></CardHeader>
            <CardContent className="p-0"><div className="relative h-[420px] overflow-hidden bg-[#eaf0f5]"><div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(27deg, transparent 47%, rgba(148,163,184,.35) 48%, rgba(148,163,184,.35) 49%, transparent 50%), linear-gradient(118deg, transparent 46%, rgba(148,163,184,.25) 47%, rgba(148,163,184,.25) 48%, transparent 49%)", backgroundSize: "130px 105px" }} /><div className="pointer-events-none absolute inset-x-0 top-[28%] h-px rotate-[-14deg] bg-white/90" /><div className="pointer-events-none absolute inset-x-0 top-[63%] h-px rotate-[11deg] bg-white/80" /><MapView className="absolute inset-0 h-full" initialCenter={{ lat: -33.4372, lng: -70.6506 }} initialZoom={12} onMapReady={setMap} /><div className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-sky-500 text-white shadow-xl"><MapPin className="h-5 w-5" /></div><div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-white/80 bg-white/90 p-3 shadow-lg backdrop-blur"><p className="text-xs font-bold text-slate-700">{location}</p><p className="mt-1 text-xs text-slate-500">{results.length} puntos visibles en esta búsqueda</p></div></div></CardContent>
          </Card>
        </div>

        <section className="mt-6 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm shadow-sky-900/[0.04] sm:p-6" aria-labelledby="real-export-title">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">Descarga directa</p>
              <h3 id="real-export-title" className="mt-1 font-display text-xl font-bold tracking-tight text-slate-900">Exportar comercios como archivo real</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Estos botones envían los datos al servidor y devuelven un archivo CSV adjunto. No usan enlaces Blob ni descargas simuladas.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href="/exportar" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 sm:w-auto">Abrir exportador independiente</a>
              <form method="post" action="/api/export/csv" onSubmit={event => { if (selectedLeads.length === 0) { event.preventDefault(); toast.info("No hay comercios seleccionados."); } else { toast.success(`Solicitando archivo con ${selectedLeads.length} comercios.`); } }}>
                <input type="hidden" name="payload" value={JSON.stringify(selectedLeads)} />
                <button data-testid="download-selected-csv" type="submit" disabled={selectedLeads.length === 0} className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"><Download className="h-4 w-4" /> Descargar seleccionados ({selectedLeads.length})</button>
              </form>
              <form method="post" action="/api/export/csv" onSubmit={() => toast.success(`Solicitando archivo completo con ${results.length} comercios.`)}>
                <input type="hidden" name="payload" value={JSON.stringify(results)} />
                <button data-testid="download-all-csv" type="submit" disabled={results.length === 0} className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-auto"><Download className="h-4 w-4" /> Descargar todos ({results.length})</button>
              </form>
            </div>
          </div>
        </section>

        <footer className="mt-7 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p>Los datos provienen de Google Places y deben utilizarse respetando sus condiciones.</p><p className="font-medium text-slate-500">MapaLeads <span className="mx-1 text-slate-300">·</span> v0.1</p></footer>
      </div>
    </div>
  );
}
