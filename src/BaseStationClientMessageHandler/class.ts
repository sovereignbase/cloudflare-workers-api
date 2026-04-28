import { encode, decode } from '@msgpack/msgpack'
import { Cryptographic } from '@sovereignbase/cryptosuite'
import type {
  BaseStationClientMessage,
  BaseStationClientMessageHandlerEventMap,
  BaseStationClientMessageHandlerEventListenerFor,
} from '../.types/index.js'

/**
 * ANBS base station client message event target.
 *
 * The handler decodes MessagePack messages received by a `BaseStation`
 * Durable Object, validates the supported request shapes, and dispatches typed
 * DOM `CustomEvent` instances for accepted client message kinds.
 */
export class BaseStationClientMessageHandler {
  private static readonly eventTarget = new EventTarget()

  /**
   * Decodes and dispatches an ANBS client protocol message.
   *
   * Invalid encodings and unsupported message shapes dispatch a `violation`
   * event with a diagnostic string.
   *
   * @param message The MessagePack-encoded ANBS client message.
   */
  static ingest(message: ArrayBuffer) {
    if (!(message instanceof ArrayBuffer))
      return void this.eventTarget.dispatchEvent(
        new CustomEvent('violation', { detail: 'Wrong message encoding' })
      )
    let decoded = undefined

    try {
      decoded = decode(message) as BaseStationClientMessage
    } catch {
      return void this.eventTarget.dispatchEvent(
        new CustomEvent('violation', { detail: 'Wrong message encoding' })
      )
    }

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !Object.hasOwn(decoded, 'kind')
    )
      return void this.eventTarget.dispatchEvent(
        new CustomEvent('violation', { detail: 'Wrong message shape' })
      )

    switch (decoded.kind) {
      case 'cipherStorePut': {
        const { detail } = decoded
        if (
          !detail ||
          typeof detail !== 'object' ||
          !Object.hasOwn(detail, 'id') ||
          !Object.hasOwn(detail, 'iv') ||
          !Object.hasOwn(detail, 'salt') ||
          !Object.hasOwn(detail, 'ciphertext')
        )
          return void this.eventTarget.dispatchEvent(
            new CustomEvent('violation', { detail: 'Wrong message shape' })
          )
        const { id, iv, salt, ciphertext } = detail
        if (
          !Cryptographic.identifier.validate(id) ||
          !(iv instanceof Uint8Array) ||
          !(salt instanceof Uint8Array) ||
          !(ciphertext instanceof ArrayBuffer)
        )
          return void this.eventTarget.dispatchEvent(
            new CustomEvent('violation', { detail: 'Wrong message shape' })
          )

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('resourceBackup', {
            detail: { id, buffer: encode({ iv, salt, ciphertext }) },
          })
        )
      }
      case 'iceServers': {
        const detail = Object.hasOwn(decoded, 'detail') ? decoded.detail : {}
        if (
          !detail ||
          typeof detail !== 'object' ||
          (detail.id !== undefined && typeof detail.id !== 'string')
        )
          return void this.eventTarget.dispatchEvent(
            new CustomEvent('violation', { detail: 'Wrong message shape' })
          )

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('iceServers', { detail })
        )
      }
      case 'invoiceStatus': {
        const { detail } = decoded
        if (
          !detail ||
          typeof detail !== 'object' ||
          !Object.hasOwn(detail, 'invoiceId') ||
          typeof detail.invoiceId !== 'string' ||
          (detail.id !== undefined && typeof detail.id !== 'string')
        )
          return void this.eventTarget.dispatchEvent(
            new CustomEvent('violation', { detail: 'Wrong message shape' })
          )

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('invoiceStatus', { detail })
        )
      }
      case 'checkoutStatus': {
        const { detail } = decoded
        if (
          !detail ||
          typeof detail !== 'object' ||
          !Object.hasOwn(detail, 'checkoutSessionId') ||
          typeof detail.checkoutSessionId !== 'string' ||
          (detail.id !== undefined && typeof detail.id !== 'string')
        )
          return void this.eventTarget.dispatchEvent(
            new CustomEvent('violation', { detail: 'Wrong message shape' })
          )

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('checkoutStatus', { detail })
        )
      }
    }
  }

  /**
   * Appends an event listener for ANBS client message events.
   *
   * @param type The event type to listen for.
   * @param listener The callback or listener object that receives the event.
   * @param options Options that control listener registration.
   */
  static addEventListener<
    K extends keyof BaseStationClientMessageHandlerEventMap,
  >(
    type: K,
    listener: BaseStationClientMessageHandlerEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes a previously registered ANBS client message event listener.
   *
   * @param type The event type to remove.
   * @param listener The callback or listener object to remove.
   * @param options Options that identify the listener registration.
   */
  static removeEventListener<
    K extends keyof BaseStationClientMessageHandlerEventMap,
  >(
    type: K,
    listener: BaseStationClientMessageHandlerEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
}
