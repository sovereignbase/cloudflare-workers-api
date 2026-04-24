/// <reference lib="dom" />

import type { Context } from "hono";

export type AppContext = Context<{ Bindings: Env }>;

export type ClientConfig = {
  clientId: string;
  allowedOrigins: string[];
  stripeCustomerId: string | undefined;
};

export type BaseStationMessage = {
  kind: "iceServers";
  detail: RTCIceServer[] | false;
};

export type StripeCheckoutStatus = "paid" | "unpaid" | "no_payment_required";

export type StripeInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void"
  | null;
