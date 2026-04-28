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
      detail: {
        id?: string;
        iceServers: RTCIceServer[] | false;
      };
    }
  | {
      kind: "checkoutStatus";
      detail: {
        id?: string;
        checkoutStatus: false | StripeCheckoutStatus;
      };
    }
  | {
      kind: "invoiceStatus";
      detail: {
        id?: string;
        invoiceStatus: false | StripeInvoiceStatus;
      };
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
  | { kind: "iceServers"; detail?: { id?: string } }
  | { kind: "invoiceStatus"; detail: { id?: string; invoiceId: string } }
  | {
      kind: "checkoutStatus";
      detail: { id?: string; checkoutSessionId: string };
    };

export type BaseStationClientTransactMessage = Extract<
  ActorMessage,
  | { kind: "iceServers" }
  | { kind: "invoiceStatus" }
  | { kind: "checkoutStatus" }
>;

/**
 * Maps event names to their `CustomEvent.detail` payloads.
 */
export type ActorMessageHandlerEventMap = {
  violation: string;
  resourceBackup: {
    id: OpaqueIdentifier;
    buffer: Uint8Array<ArrayBuffer>;
  };
  iceServers: { id?: string };
  invoiceStatus: { id?: string; invoiceId: string };
  checkoutStatus: { id?: string; checkoutSessionId: string };
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

export type BaseStationClientEventMap = {
  message: CustomEvent<BaseStationMessage>;
};

export type BaseStationMessageHandlerEventMap = {
  iceServers: CustomEvent<Extract<BaseStationMessage, { kind: "iceServers" }>>;
  checkoutStatus: CustomEvent<
    Extract<BaseStationMessage, { kind: "checkoutStatus" }>
  >;
  invoiceStatus: CustomEvent<
    Extract<BaseStationMessage, { kind: "invoiceStatus" }>
  >;
};

export type BaseStationMessageHandlerEventListener<
  K extends keyof BaseStationMessageHandlerEventMap,
> =
  | ((event: BaseStationMessageHandlerEventMap[K]) => void)
  | { handleEvent(event: BaseStationMessageHandlerEventMap[K]): void };

export type BaseStationMessageHandlerEventListenerFor<K extends string> =
  K extends keyof BaseStationMessageHandlerEventMap ?
    BaseStationMessageHandlerEventListener<K>
  : EventListenerOrEventListenerObject;

export type BaseStationClientEventListenerFor<
  K extends keyof BaseStationClientEventMap,
> =
  | ((event: BaseStationClientEventMap[K]) => void)
  | { handleEvent(event: BaseStationClientEventMap[K]): void };

export type BaseStationClientPendingTransact<T> = {
  resolve: (message: T | false) => void;
  reject: (reason?: unknown) => void;
  cleanup: () => void;
};

export type BaseStationClientTransactOptions = {
  signal?: AbortSignal;
  ttlMs?: number;
};
