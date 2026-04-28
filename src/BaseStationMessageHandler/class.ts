import { decode } from '@msgpack/msgpack'
import type {
  BaseStationMessage,
  BaseStationMessageHandlerEventListenerFor,
  BaseStationMessageHandlerEventMap,
} from '../.types/index.js'

/**
 * ANBS base station message event target.
 *
 * The handler decodes MessagePack messages received by a
 * {@link BaseStationClient}, validates the supported response shapes, and
 * dispatches typed DOM `CustomEvent` instances for each accepted message kind.
 */
export class BaseStationMessageHandler {
  private readonly eventTarget = new EventTarget()

  /**
   * Decodes and dispatches a base station response message.
   *
   * Invalid encodings and unsupported message shapes are ignored.
   *
   * @param message The MessagePack-encoded base station message.
   */
  ingest(message: ArrayBuffer) {
    if (!(message instanceof ArrayBuffer)) return

    let decoded = undefined

    try {
      decoded = decode(message) as BaseStationMessage
    } catch {
      return
    }

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !Object.hasOwn(decoded, 'kind') ||
      !Object.hasOwn(decoded, 'detail') ||
      typeof decoded.detail !== 'object' ||
      decoded.detail === null
    )
      return

    switch (decoded.kind) {
      case 'iceServers': {
        const { detail } = decoded
        if (
          !Object.hasOwn(detail, 'iceServers') ||
          (detail.id !== undefined && typeof detail.id !== 'string') ||
          (detail.iceServers !== false && !Array.isArray(detail.iceServers))
        )
          return

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('iceServers', { detail: decoded })
        )
      }
      case 'checkoutStatus': {
        const { detail } = decoded
        if (
          !Object.hasOwn(detail, 'checkoutStatus') ||
          (detail.id !== undefined && typeof detail.id !== 'string') ||
          (detail.checkoutStatus !== false &&
            detail.checkoutStatus !== 'paid' &&
            detail.checkoutStatus !== 'unpaid' &&
            detail.checkoutStatus !== 'no_payment_required')
        )
          return

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('checkoutStatus', { detail: decoded })
        )
      }
      case 'invoiceStatus': {
        const { detail } = decoded
        if (
          !Object.hasOwn(detail, 'invoiceStatus') ||
          (detail.id !== undefined && typeof detail.id !== 'string') ||
          (detail.invoiceStatus !== false &&
            detail.invoiceStatus !== null &&
            detail.invoiceStatus !== 'draft' &&
            detail.invoiceStatus !== 'open' &&
            detail.invoiceStatus !== 'paid' &&
            detail.invoiceStatus !== 'uncollectible' &&
            detail.invoiceStatus !== 'void')
        )
          return

        return void this.eventTarget.dispatchEvent(
          new CustomEvent('invoiceStatus', { detail: decoded })
        )
      }
    }
  }

  /**
   * Appends an event listener for base station response events.
   *
   * @param type The event type to listen for.
   * @param listener The callback or listener object that receives the event.
   * @param options Options that control listener registration.
   */
  addEventListener<K extends keyof BaseStationMessageHandlerEventMap>(
    type: K,
    listener: BaseStationMessageHandlerEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes a previously registered base station response event listener.
   *
   * @param type The event type to remove.
   * @param listener The callback or listener object to remove.
   * @param options Options that identify the listener registration.
   */
  removeEventListener<K extends keyof BaseStationMessageHandlerEventMap>(
    type: K,
    listener: BaseStationMessageHandlerEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
}
