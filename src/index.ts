import { z } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fromHono, OpenAPIRoute } from "chanfana";
import type { AppContext } from "./types.js";

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
      "400": {
        description: "Not a WebSocket handshake",
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
    const upgrade = validated.headers.upgrade.toLowerCase();
    const connection = validated.headers.connection.toLowerCase();
    if (upgrade !== "websocket" || !connection.includes("upgrade")) {
      return context.json(
        {
          ok: false,
          error: "Expected a WebSocket handshake (Upgrade headers).",
        },
        400,
      );
    }
    return context.env.USER_PROXY.get(
      context.env.USER_PROXY.newUniqueId(),
    ).fetch(context.req.raw);
  }
}

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    credentials: false,
    allowMethods: ["GET"],
    origin: ["*"],
    allowHeaders: [
      "upgrade",
      "connection",
      "sec-websocket-key",
      "sec-websocket-version",
    ],
  }),
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/:id", ProxyResolver);

// Export the Hono app
export default app;
export { UserProxy } from "./UserProxy/class.js";
export { ServiceProxy } from "./ServiceProxy/class.js";
export { ResourceProxy } from "./ResourceProxy/class.js";
