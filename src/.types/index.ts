/// <reference lib="dom" />

import type { Context } from "hono";

import type { OpaqueIdentifier } from "@sovereignbase/cryptosuite";

export type AppContext = Context<{ Bindings: Env }>;

export type ClientConfig = {
  clientId: string;
  allowedOrigins: string[];
  stripeCustomerId: string | undefined;
};

export type BaseStationMessage =
  | {
      kind: "iceServers";
      detail: RTCIceServer[] | false;
    }
  | {
      kind: "checkoutStatus";
      detail: false | StripeCheckoutStatus;
    }
  | {
      kind: "invoiceStatus";
      detail: false | StripeInvoiceStatus;
    };

export type StripeCheckoutStatus = "paid" | "unpaid" | "no_payment_required";

export type StripeInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void"
  | null;

/**
 * Decoded actor protocol message.
 */
export type ActorMessage =
  | {
      kind: "resourceBackup";
      detail: {
        id: OpaqueIdentifier;
        iv: Uint8Array;
        salt: Uint8Array;
        ciphertext: ArrayBuffer;
      };
    }
  | { kind: "iceServers" }
  | { kind: "invoiceStatus"; detail: { invoiceId: string } }
  | { kind: "checkoutStatus"; detail: { checkoutSessionId: string } };

/**
 * Maps event names to their `CustomEvent.detail` payloads.
 */
export type ActorMessageHandlerEventMap = {
  violation: string;
  resourceBackup: {
    id: OpaqueIdentifier;
    buffer: Uint8Array<ArrayBuffer>;
  };
  iceServers: undefined;
  invoiceStatus: { invoiceId: string };
  checkoutStatus: { checkoutSessionId: string };
};

/**
 * Actor message handler event listener.
 */
export type ActorMessageHandlerEventListener<
  K extends keyof ActorMessageHandlerEventMap,
> =
  | ((event: CustomEvent<ActorMessageHandlerEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<ActorMessageHandlerEventMap[K]>): void };

/**
 * Resolves an event name to its listener type.
 */
export type ActorMessageHandlerEventListenerFor<K extends string> =
  K extends keyof ActorMessageHandlerEventMap ?
    ActorMessageHandlerEventListener<K>
  : EventListenerOrEventListenerObject;

/////////////////////////////////////////////////////

export type BaseStationClientEventMap<T> = {
  message: CustomEvent<T>;
  open: Event;
  close: Event;
  error: Event;
};

export type BaseStationClientEventListenerFor<
  T,
  K extends keyof BaseStationClientEventMap<T>,
> =
  | ((event: BaseStationClientEventMap<T>[K]) => void)
  | { handleEvent(event: BaseStationClientEventMap<T>[K]): void };

export type BaseStationClientRemoteMessageShape<T> =
  | T
  | ["station-client-request", string, T];

export type BaseStationClientPendingTransact<T> = {
  resolve: (message: T | false) => void;
  reject: (reason?: unknown) => void;
  cleanup: () => void;
};

export type BaseStationClientTransactOptions = {
  signal?: AbortSignal;
  ttlMs?: number;
};
