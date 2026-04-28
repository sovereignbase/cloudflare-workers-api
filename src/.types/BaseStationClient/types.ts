/// <reference lib="dom" />

import type { OpaqueIdentifier } from '@sovereignbase/cryptosuite'
import type { BaseStationMessage } from '../types.js'

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
       * Transaction id.
       */
      id: string

      /**
       * Request generated WebRTC ICE servers.
       */
      kind: 'iceServersGet'

      /**
       * Transaction detail.
       */
      detail: {}
    }
  | {
      /**
       * Transaction id.
       */
      id: string

      /**
       * Request a Stripe invoice status.
       */
      kind: 'invoiceStatusGet'

      /**
       * Invoice status request detail.
       */
      detail: {
        /**
         * Stripe invoice id.
         */
        invoiceId: string
      }
    }
  | {
      /**
       * Transaction id.
       */
      id: string

      /**
       * Request a Stripe Checkout Session payment status.
       */
      kind: 'checkoutStatusGet'

      /**
       * Checkout status request detail.
       */
      detail: {
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
  | { kind: 'iceServersGet' }
  | { kind: 'invoiceStatusGet' }
  | { kind: 'checkoutStatusGet' }
>

/**
 * ANBS client message kinds that just fire and forget.
 */
export type BaseStationClientInvokeMessage = Extract<
  BaseStationClientMessage,
  { kind: 'cipherStorePut' }
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
  cipherStorePut: {
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
  iceServersGet: { id: string }

  /**
   * Emitted for validated Stripe invoice status requests.
   */
  invoiceStatusGet: { id: string; invoiceId: string }

  /**
   * Emitted for validated Stripe Checkout Session status requests.
   */
  checkoutStatusGet: { id: string; checkoutSessionId: string }
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

/**
 * Listener accepted by `BaseStationClient`.
 */
export type BaseStationClientEventListenerFor<
  K extends keyof BaseStationClientEventMap,
> =
  | ((event: BaseStationClientEventMap[K]) => void)
  | { handleEvent(event: BaseStationClientEventMap[K]): void }
