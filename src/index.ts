import { Hono } from "hono";
import { fromHono } from "chanfana";
import { BaseStationResolver } from "./BaseStationResolver/class.js";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app);

// Register OpenAPI endpoints
openapi.get("/:clientId", BaseStationResolver);

export default app;
export { BaseStationResolver };
export { BaseStation } from "./BaseStation/class.js";
export { BaseStationClient } from "./BaseStationClient/index.js";
export { ActorMessageHandler } from "./ActorMessageHandler/class.js";
export { BaseStationMessageHandler } from "./BaseStationMessageHandler/class.js";
