import { app } from "@worker/app";
import type { Bindings } from "@worker/bindings";

export default {
  fetch(request, env, executionContext) {
    return app.fetch(request, env, executionContext);
  },
  scheduled() {},
} satisfies ExportedHandler<Bindings>;
