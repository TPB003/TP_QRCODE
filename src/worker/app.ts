import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings } from "@worker/bindings";
import { assetRoutes } from "@worker/routes/asset-routes";
import { authRoutes } from "@worker/routes/auth-routes";
import { projectRoutes } from "@worker/routes/project-routes";
import { publicRoutes } from "@worker/routes/public-routes";

export const app = new Hono<{ Bindings: Bindings }>();

function mutableAssetResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function localSpaFallback(): Response {
  return new Response("<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><title>TP QR</title></head><body><div id=\"root\"></div></body></html>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}

const apiCors = createMiddleware<{ Bindings: Bindings }>(async (context, next) => {
  const requestOrigin = context.req.header("Origin");
  const allowedOrigin = requestOrigin === context.env.APP_ORIGIN ? requestOrigin : undefined;

  if (context.req.method === "OPTIONS") {
    if (allowedOrigin) {
      context.header("Access-Control-Allow-Origin", allowedOrigin);
      context.header("Access-Control-Allow-Credentials", "true");
    }
    context.header("Access-Control-Allow-Headers", "Content-Type, X-Revision");
    context.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    context.header("Access-Control-Max-Age", "86400");
    context.header("Vary", "Origin");
    return context.body(null, 204);
  }

  await next();

  if (allowedOrigin) {
    context.header("Access-Control-Allow-Origin", allowedOrigin);
    context.header("Access-Control-Allow-Credentials", "true");
    context.header("Vary", "Origin");
  }
});

app.use("*", secureHeaders());
app.use("/api/*", apiCors);

app.route("/api/auth", authRoutes);
app.route("/api", projectRoutes);
app.route("/api", assetRoutes);
app.route("/api/public", publicRoutes);

app.get("/api/health", (context) =>
  context.json({
    data: {
      status: "ok",
      environment: context.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  }),
);

app.notFound(async (context) => {
  if (!context.req.path.startsWith("/api/") && context.env.ASSETS) {
    // Assets' automatic SPA fallback can throw while Wrangler is translating
    // a navigation request. Fetch the immutable entry explicitly for public
    // scan routes so both local and deployed Workers return the SPA shell.
    if (context.req.path.startsWith("/s/")) {
      const indexRequest = new Request(new URL("/index.html", context.req.url), {
        method: "GET",
        headers: context.req.raw.headers,
      });
      const indexResponse = await context.env.ASSETS.fetch(indexRequest);
      if (indexResponse.ok) return mutableAssetResponse(indexResponse);
      if (context.env.ENVIRONMENT !== "production") return localSpaFallback();
      return mutableAssetResponse(indexResponse);
    }
    const assetResponse = await context.env.ASSETS.fetch(context.req.raw);
    if (assetResponse.status !== 404) return mutableAssetResponse(assetResponse);
  }
  return context.json({ error: { code: "NOT_FOUND", message: "请求的资源不存在" } }, 404);
});

app.onError((error, context) => {
  console.error(error);
  return context.json({ error: { code: "INTERNAL_ERROR", message: "服务器暂时无法处理请求" } }, 500);
});
