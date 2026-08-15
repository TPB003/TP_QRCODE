import { app } from "@worker/app";
import type { Bindings } from "@worker/bindings";

export default {
  fetch(request, env, executionContext) {
    return app.fetch(request, env, executionContext);
  },
  async scheduled(controller, env) {
    const timestamp = new Date().toISOString();
    await env.DB.prepare("DELETE FROM auth_codes WHERE expires_at < ? OR used_at IS NOT NULL").bind(timestamp).run();
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL").bind(timestamp).run();
    await env.DB.prepare("DELETE FROM rate_limits WHERE bucket_start < datetime('now', '-2 hours')").run();
    await env.DB.prepare("DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')").run();
    await env.DB.prepare("DELETE FROM qr_codes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')").run();
    await env.DB.prepare("DELETE FROM qr_access_events WHERE occurred_at < datetime('now', '-180 days')").run();
    await env.DB.prepare("DELETE FROM analytics_daily_codes WHERE date < date('now', '-400 days')").run();
    const expiredAssets = await env.DB.prepare("SELECT object_key FROM assets WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')").all<{ object_key: string }>();
    for (const asset of expiredAssets.results) await env.ASSETS_BUCKET.delete(asset.object_key);
    await env.DB.prepare("DELETE FROM assets WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')").run();
    void controller;
  },
} satisfies ExportedHandler<Bindings>;
