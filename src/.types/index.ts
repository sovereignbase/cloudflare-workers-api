import type { Context } from "hono";

export type AppContext = Context<{ Bindings: Env }>;

export type BillingData = {
  id: string;
  allowedOrigins: string[];
};
