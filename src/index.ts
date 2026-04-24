import { z } from "zod";
import { Hono } from "hono";
import { fromHono, OpenAPIRoute } from "chanfana";
import type { AppContext } from "./.types/index.js";
import { fetchBillingData, isAllowedOrigin } from "./.helpers/index.js";

export class ProxyResolver extends OpenAPIRoute {
  schema = {
    tags: ["Base station", "Relay"],
    summary: "Upgrade to WebSocket for relay session",
    request: {
      headers: z.object({
        origin: z.string(),
        upgrade: z.string(),
        connection: z.string(),
        "cf-connecting-ip": z.string(),
        "sec-websocket-key": z.string().min(1),
        "sec-websocket-version": z.literal("13"),
      }),
      params: z.object({
        id: z.string().min(64),
      }),
    },
    responses: {
      "101": { description: "WebSocket upgrade" },
      "404": {
        description: "Not found.",
        content: {
          "application/json": {
            schema: z.object({
              ok: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(context: AppContext) {
    const validated = await this.getValidatedData<typeof this.schema>();
    const id = validated.params.id;

    const billing = await fetchBillingData(context, id);
    if (!billing) return context.text("Not found", 404);

    const origin = validated.headers.origin.toLowerCase();
    if (!isAllowedOrigin(origin, billing.allowedOrigins))
      return context.text("Not found", 404);

    const upgrade = validated.headers.upgrade.toLowerCase();
    const connection = validated.headers.connection.toLowerCase();
    if (upgrade !== "websocket" || !connection.includes("upgrade"))
      return context.text("Not found", 404);

    return context.env.USER_PROXY.get(
      context.env.USER_PROXY.newUniqueId(),
    ).fetch(context.req.raw);
  }
}

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/:id", ProxyResolver);

// Export the Hono app
export default app;
export { BaseStation } from "./BaseStation/class.js";
export { ServiceProxy } from "./ServiceProxy/class.js";
