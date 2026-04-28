/// <reference lib="dom" />

import type { Context } from 'hono'

import type { OpaqueIdentifier } from '@sovereignbase/cryptosuite'

/**
 * Hono request context for the ANBS base station Worker.
 */
export type AppContext = Context<{ Bindings: Env }>

/**
 * Persisted configuration for one ANBS base station client.
 */
export type ClientConfig = {
  /**
   * Opaque client identifier used to resolve the base station configuration.
   */
  clientId: string

  /**
   * Origins that are allowed to open a base station WebSocket session.
   */
  allowedOrigins: string[]

  /**
   * Stripe customer identifier associated with the client, when available.
   */
  stripeCustomerId: string | undefined
}

/**
 * Message sent by the base station to a connected ANBS client.
 */
export type BaseStationMessage =
  | {
      /**
       * Response containing generated WebRTC ICE servers.
       */
      kind: 'iceServers'

      /**
       * ICE server response details.
       */
      detail: {
        /**
         * Optional transaction id that correlates the response to a request.
         */
        id?: string

        /**
         * Generated ICE servers, or `false` when they could not be generated.
         */
        iceServers: RTCIceServer[] | false
      }
    }
  | {
      /**
       * Response containing a Stripe Checkout Session payment status.
       */
      kind: 'checkoutStatus'

      /**
       * Checkout status response details.
       */
      detail: {
        /**
         * Optional transaction id that correlates the response to a request.
         */
        id?: string

        /**
         * Stripe checkout payment status, or `false` when unavailable.
         */
        checkoutStatus: false | StripeCheckoutStatus
      }
    }
  | {
      /**
       * Response containing a Stripe invoice status.
       */
      kind: 'invoiceStatus'

      /**
       * Invoice status response details.
       */
      detail: {
        /**
         * Optional transaction id that correlates the response to a request.
         */
        id?: string

        /**
         * Stripe invoice status, or `false` when unavailable.
         */
        invoiceStatus: false | StripeInvoiceStatus
      }
    }

/**
 * Stripe Checkout Session payment statuses exposed by base station responses.
 */
export type StripeCheckoutStatus = 'paid' | 'unpaid' | 'no_payment_required'

/**
 * Stripe invoice statuses exposed by base station responses.
 */
export type StripeInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'
  | null

/**
 * Message sent by an ANBS client to the base station.
 */
export type BaseStationClientMessage =
  | {
      /**
       * Request to persist an encrypted resource backup.
       */
      kind: 'cipherStorePut'

      /**
       * Encrypted resource backup payload.
       */
      detail: {
        /**
         * Opaque resource identifier.
         */
        id: OpaqueIdentifier

        /**
         * AES-GCM initialization vector.
         */
        iv: Uint8Array

        /**
         * Key derivation salt.
         */
        salt: Uint8Array

        /**
         * Encrypted resource bytes.
         */
        ciphertext: ArrayBuffer
      }
    }
  | {
      /**
       * Request generated WebRTC ICE servers.
       */
      kind: 'iceServers'

      /**
       * Optional transaction detail.
       */
      detail?: {
        /**
         * Optional transaction id.
         */
        id?: string
      }
    }
  | {
      /**
       * Request a Stripe invoice status.
       */
      kind: 'invoiceStatus'

      /**
       * Invoice status request detail.
       */
      detail: {
        /**
         * Optional transaction id.
         */
        id?: string

        /**
         * Stripe invoice id.
         */
        invoiceId: string
      }
    }
  | {
      /**
       * Request a Stripe Checkout Session payment status.
       */
      kind: 'checkoutStatus'

      /**
       * Checkout status request detail.
       */
      detail: {
        /**
         * Optional transaction id.
         */
        id?: string

        /**
         * Stripe Checkout Session id.
         */
        checkoutSessionId: string
      }
    }

/**
 * ANBS client message kinds that expect a correlated base station response.
 */
export type BaseStationClientTransactMessage = Extract<
  BaseStationClientMessage,
  | { kind: 'iceServers' }
  | { kind: 'invoiceStatus' }
  | { kind: 'checkoutStatus' }
>

/**
 * Maps `BaseStationClientMessageHandler` event names to `CustomEvent.detail`
 * payloads.
 */
export type BaseStationClientMessageHandlerEventMap = {
  /**
   * Emitted when an incoming client message violates the supported protocol.
   */
  violation: string

  /**
   * Emitted for validated encrypted resource backup requests.
   */
  resourceBackup: {
    /**
     * Opaque resource identifier.
     */
    id: OpaqueIdentifier

    /**
     * MessagePack-encoded encrypted resource backup payload.
     */
    buffer: Uint8Array<ArrayBuffer>
  }

  /**
   * Emitted for validated ICE server requests.
   */
  iceServers: { id?: string }

  /**
   * Emitted for validated Stripe invoice status requests.
   */
  invoiceStatus: { id?: string; invoiceId: string }

  /**
   * Emitted for validated Stripe Checkout Session status requests.
   */
  checkoutStatus: { id?: string; checkoutSessionId: string }
}

/**
 * Listener accepted by `BaseStationClientMessageHandler`.
 */
export type BaseStationClientMessageHandlerEventListener<
  K extends keyof BaseStationClientMessageHandlerEventMap,
> =
  | ((event: CustomEvent<BaseStationClientMessageHandlerEventMap[K]>) => void)
  | {
      handleEvent(
        event: CustomEvent<BaseStationClientMessageHandlerEventMap[K]>
      ): void
    }

/**
 * Resolves a `BaseStationClientMessageHandler` event name to its listener
 * type.
 */
export type BaseStationClientMessageHandlerEventListenerFor<K extends string> =
  K extends keyof BaseStationClientMessageHandlerEventMap
    ? BaseStationClientMessageHandlerEventListener<K>
    : EventListenerOrEventListenerObject

/////////////////////////////////////////////////////

/**
 * Maps `BaseStationClient` event names to DOM event objects.
 */
export type BaseStationClientEventMap = {
  /**
   * Emitted when the client receives an unmatched base station response.
   */
  message: CustomEvent<BaseStationMessage>
}

/**
 * Maps `BaseStationMessageHandler` event names to DOM event objects.
 */
export type BaseStationMessageHandlerEventMap = {
  /**
   * Emitted for validated ICE server responses.
   */
  iceServers: CustomEvent<Extract<BaseStationMessage, { kind: 'iceServers' }>>

  /**
   * Emitted for validated Stripe Checkout Session status responses.
   */
  checkoutStatus: CustomEvent<
    Extract<BaseStationMessage, { kind: 'checkoutStatus' }>
  >

  /**
   * Emitted for validated Stripe invoice status responses.
   */
  invoiceStatus: CustomEvent<
    Extract<BaseStationMessage, { kind: 'invoiceStatus' }>
  >
}

/**
 * Listener accepted by `BaseStationMessageHandler`.
 */
export type BaseStationMessageHandlerEventListener<
  K extends keyof BaseStationMessageHandlerEventMap,
> =
  | ((event: BaseStationMessageHandlerEventMap[K]) => void)
  | { handleEvent(event: BaseStationMessageHandlerEventMap[K]): void }

/**
 * Resolves a `BaseStationMessageHandler` event name to its listener type.
 */
export type BaseStationMessageHandlerEventListenerFor<K extends string> =
  K extends keyof BaseStationMessageHandlerEventMap
    ? BaseStationMessageHandlerEventListener<K>
    : EventListenerOrEventListenerObject

/**
 * Listener accepted by `BaseStationClient`.
 */
export type BaseStationClientEventListenerFor<
  K extends keyof BaseStationClientEventMap,
> =
  | ((event: BaseStationClientEventMap[K]) => void)
  | { handleEvent(event: BaseStationClientEventMap[K]): void }

/**
 * Pending transaction record stored by `BaseStationClient`.
 */
export type BaseStationClientPendingTransact<T> = {
  /**
   * Resolves the transaction with a response message or `false`.
   */
  resolve: (message: T | false) => void

  /**
   * Rejects the transaction with an abort or close reason.
   */
  reject: (reason?: unknown) => void

  /**
   * Releases transaction-local timers and event listeners.
   */
  cleanup: () => void
}

/**
 * Options for `BaseStationClient.transact`.
 */
export type BaseStationClientTransactOptions = {
  /**
   * Signal used to abort the transaction.
   */
  signal?: AbortSignal

  /**
   * Transaction time-to-live in milliseconds.
   */
  ttlMs?: number
}
