import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createCsvDownload } from "../exportCsv";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const exportSample = [
  { name: "Café Altura", phone: "+56 2 2345 6789", address: "Av. Providencia 1234, Santiago", website: "https://cafealtura.cl", rating: 4.8, reviews: 318, status: "Activo" },
  { name: "Taller Norte", phone: "+56 9 8765 4321", address: "Manuel Montt 845, Providencia", website: "", rating: 4.6, reviews: 94, status: "Activo" },
  { name: "La Bodega Verde", phone: "+56 2 2987 1132", address: "Av. Italia 1610, Ñuñoa", website: "https://labodegaverde.cl", rating: 4.7, reviews: 186, status: "Activo" },
  { name: "Estudio Marea", phone: "No publicado", address: "Av. Santa Isabel 550, Santiago", website: "https://estudiomarea.com", rating: 4.4, reviews: 61, status: "Verificar" },
  { name: "Panadería La Esquina", phone: "+56 9 7123 9088", address: "Av. Irarrázaval 2330, Ñuñoa", website: "", rating: 4.9, reviews: 427, status: "Activo" },
];

function sendCsv(res: express.Response, payload: string) {
  const csv = createCsvDownload(payload);
  const filename = `mapaleads-${new Date().toISOString().slice(0, 10)}.csv`;
  res.status(200);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\ufeff${csv}`);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/exportar", (_req, res) => {
    const payload = escapeHtml(JSON.stringify(exportSample));
    res.type("html").send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exportar comercios · MapaLeads</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}main{max-width:760px;margin:auto;background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:32px;box-shadow:0 12px 35px #0f172a12}h1{margin:0 0 8px}p{color:#475569;line-height:1.6}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}button,a{border:0;border-radius:10px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none}button{background:#020617;color:#fff}a{background:#e0f2fe;color:#075985}small{display:block;margin-top:22px;color:#64748b}</style></head><body><main><h1>Exportador independiente</h1><p>Esta página no depende de los botones ni del JavaScript de la aplicación principal. El botón negro envía un formulario HTML directamente al servidor y descarga un CSV adjunto real.</p><div class="actions"><form method="post" action="/api/export/csv"><input type="hidden" name="payload" value="${payload}"><button type="submit">Descargar CSV de comercios</button></form><a href="/">Volver a MapaLeads</a></div><small>La descarga de esta página contiene la muestra actualmente disponible. Las búsquedas nuevas se pueden exportar desde la sección de descarga de la aplicación.</small></main></body></html>`);
  });
  app.get("/api/export/csv/sample", (_req, res) => sendCsv(res, JSON.stringify(exportSample)));
  app.post("/api/export/csv", (req, res) => {
    try {
      const payload = typeof req.body?.payload === "string" ? req.body.payload : "[]";
      sendCsv(res, payload);
    } catch {
      res.status(400).json({ error: "No se pudo preparar el archivo CSV." });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
