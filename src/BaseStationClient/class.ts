import { encode } from '@msgpack/msgpack'
import type {
  BaseStationClientEventListenerFor,
  BaseStationClientPendingTransact,
  BaseStationClientTransactOptions,
  BaseStationClientEventMap,
  BaseStationClientInvokeMessage,
  BaseStationClientTransactMessage,
  BaseStationClientTransactResponse,
} from '../.types/types.js'
import { BaseStationMessageHandler } from '../BaseStationMessageHandler/class.js'

/**
 * ANBS base station WebSocket client.
 *
 * A client opens a WebSocket connection to a base station endpoint, sends
 * MessagePack-encoded ANBS client messages, and exposes DOM-style event
 * listener methods for base station responses.
 */
export class BaseStationClient {
  private readonly eventTarget = new EventTarget()
  private readonly webSocketUrl: string
  private webSocket: WebSocket | null = null
  private isClosed: boolean = false
  private readonly pendingTransacts = new Map<
    string,
    BaseStationClientPendingTransact<
      BaseStationClientTransactResponse<
        BaseStationClientTransactMessage['kind']
      >
    >
  >()

  /**
   * Initializes a new {@link BaseStationClient} instance.
   *
   * The constructor attempts to open the WebSocket immediately. If the URL
   * cannot be constructed by the runtime, the instance remains closed to
   * outbound messages until a new client is created.
   *
   * @param webSocketUrl The ANBS base station WebSocket URL.
   */
  constructor(webSocketUrl: string) {
    this.webSocketUrl = webSocketUrl

    if (!this.webSocketUrl) throw new Error('')

    let socket: WebSocket
    try {
      socket = new WebSocket(this.webSocketUrl)
    } catch {
      return
    }

    socket.binaryType = 'arraybuffer'
    this.webSocket = socket

    BaseStationMessageHandler.addEventListener('iceServers', ({ detail }) => {
      const { id, iceServers } = detail
      const pending = this.pendingTransacts.get(id)
      void this.pendingTransacts.delete(id)
      void pending.cleanup()
      void pending.resolve(iceServers)
    })

    BaseStationMessageHandler.addEventListener(
      'checkoutStatus',
      ({ detail }) => {
        const { id, checkoutStatus } = detail
        const pending = this.pendingTransacts.get(id)

        void this.pendingTransacts.delete(id)
        void pending.cleanup()
        void pending.resolve(checkoutStatus)
      }
    )

    BaseStationMessageHandler.addEventListener(
      'invoiceStatus',
      ({ detail }) => {
        const { id, invoiceStatus } = detail
        const pending = this.pendingTransacts.get(id)

        void this.pendingTransacts.delete(id)
        void pending.cleanup()
        void pending.resolve(invoiceStatus)
      }
    )

    socket.onclose = () => {
      if (this.webSocket === socket) this.webSocket = null

      for (const pending of this.pendingTransacts.values()) {
        void pending.cleanup()
        void pending.reject(new Error('Station client closed'))
      }
      void this.pendingTransacts.clear()
    }

    socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      void BaseStationMessageHandler.ingest(event.data)
    }
  }

  /**
   * Sends an ANBS client message without waiting for a response.
   *
   * If the client is closed or the WebSocket is not open, the call has no
   * effect.
   *
   * @param message The client message to MessagePack-encode and send.
   */
  invoke<K extends BaseStationClientInvokeMessage['kind']>(
    kind: K,
    detail: Extract<BaseStationClientInvokeMessage, { kind: K }>['detail']
  ) {
    if (this.isClosed) return

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return

    try {
      void this.webSocket.send(encode({ kind, detail }))
    } catch {}
  }

  /**
   * Sends an ANBS client request and waits for the matching response message.
   *
   * A generated transaction id is attached to the outgoing message detail and
   * used to resolve the corresponding response. The promise resolves to
   * `false` when the request cannot be sent or when `ttlMs` elapses.
   *
   * @param message The message to send.
   * @param options Options that control cancellation and timeout.
   * @returns A promise that resolves with the matching response message, or
   * `false` when the request cannot be issued.
   */
  transact<K extends BaseStationClientTransactMessage['kind']>(
    kind: K,
    detail: Extract<BaseStationClientTransactMessage, { kind: K }>['detail'],
    options: BaseStationClientTransactOptions = {}
  ): Promise<BaseStationClientTransactResponse<K> | false> {
    if (this.isClosed) return Promise.resolve(false)
    const id = globalThis.crypto.randomUUID()
    const { signal, ttlMs } = options

    return new Promise<BaseStationClientTransactResponse<K> | false>(
      (resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const abortReason = () =>
          signal?.reason ??
          new DOMException('The operation was aborted.', 'AbortError')

        if (signal?.aborted) {
          void reject(abortReason())
          return
        }

        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
          void resolve(false)
          return
        }

        const handleAbort = () => {
          void this.pendingTransacts.delete(id)
          if (timeoutId) void clearTimeout(timeoutId)
          void signal?.removeEventListener('abort', handleAbort)

          void reject(abortReason())
        }

        void this.pendingTransacts.set(id, {
          resolve: resolve as BaseStationClientPendingTransact<
            BaseStationClientTransactResponse<
              BaseStationClientTransactMessage['kind']
            >
          >['resolve'],
          reject,
          cleanup: () => {
            if (timeoutId) void clearTimeout(timeoutId)
            void signal?.removeEventListener('abort', handleAbort)
          },
        })
        void signal?.addEventListener('abort', handleAbort, { once: true })

        if (ttlMs) {
          timeoutId = setTimeout(() => {
            void this.pendingTransacts.delete(id)
            void signal?.removeEventListener('abort', handleAbort)
            void resolve(false)
          }, ttlMs)
        }

        try {
          void this.webSocket.send(encode({ kind, detail: { id, ...detail } }))
        } catch {
          const pending = this.pendingTransacts.get(id)
          void this.pendingTransacts.delete(id)
          void pending?.cleanup()
          void resolve(false)
        }
      }
    )
  }

  /**
   * Closes the client and rejects all pending transactions.
   */
  close(): void {
    this.isClosed = true
    try {
      void this.webSocket?.close(1000, 'closed')
    } catch {}

    this.webSocket = null
    for (const pending of this.pendingTransacts.values()) {
      void pending.cleanup()
      void pending.reject(new Error('Station client closed'))
    }
    void this.pendingTransacts.clear()
  }

  /**
   * Appends an event listener for base station client events.
   *
   * @param type The event type to listen for.
   * @param listener The callback or listener object that receives the event.
   * @param options Options that control listener registration.
   */
  addEventListener<K extends keyof BaseStationClientEventMap>(
    type: K,
    listener: BaseStationClientEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes an event listener previously registered with
   * {@link BaseStationClient.addEventListener}.
   *
   * @param type The event type to remove.
   * @param listener The callback or listener object to remove.
   * @param options Options that identify the listener registration.
   */
  removeEventListener<K extends keyof BaseStationClientEventMap>(
    type: K,
    listener: BaseStationClientEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
}
