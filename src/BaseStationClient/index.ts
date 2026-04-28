import { encode } from "@msgpack/msgpack";
import type {
  ActorMessage,
  BaseStationMessage,
  BaseStationClientTransactMessage,
  BaseStationClientEventListenerFor,
  BaseStationClientPendingTransact,
  BaseStationClientTransactOptions,
  BaseStationClientEventMap,
} from "../.types/index.js";
import { BaseStationMessageHandler } from "../BaseStationMessageHandler/class.js";

/**
 * Represents a base station client that sends messages over a WebSocket transport.
 *
 */
export class BaseStationClient {
  private readonly eventTarget = new EventTarget();
  private readonly messageHandler = new BaseStationMessageHandler();
  private readonly webSocketUrl: string;
  private webSocket: WebSocket | null = null;
  private isClosed: boolean = false;
  private readonly pendingfetchs = new Map<
    string,
    BaseStationClientPendingTransact<BaseStationMessage>
  >();

  /**
   * Initializes a new {@link BaseStationClient} instance.
   *
   * @param webSocketUrl The base station WebSocket URL.
   */
  constructor(webSocketUrl: string) {
    this.webSocketUrl = webSocketUrl;

    if (!this.webSocketUrl) throw new Error("");

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.webSocketUrl);
    } catch {
      return;
    }

    socket.binaryType = "arraybuffer";
    this.webSocket = socket;

    this.messageHandler.addEventListener("iceServers", ({ detail }) => {
      const id = detail.detail.id;
      const pending = id ? this.pendingfetchs.get(id) : undefined;
      if (id && pending) {
        void this.pendingfetchs.delete(id);
        void pending.cleanup();
        void pending.resolve(detail);
        return;
      }

      void this.eventTarget.dispatchEvent(
        new CustomEvent("message", { detail }),
      );
    });

    this.messageHandler.addEventListener("checkoutStatus", ({ detail }) => {
      const id = detail.detail.id;
      const pending = id ? this.pendingfetchs.get(id) : undefined;
      if (id && pending) {
        void this.pendingfetchs.delete(id);
        void pending.cleanup();
        void pending.resolve(detail);
        return;
      }

      void this.eventTarget.dispatchEvent(
        new CustomEvent("message", { detail }),
      );
    });

    this.messageHandler.addEventListener("invoiceStatus", ({ detail }) => {
      const id = detail.detail.id;
      const pending = id ? this.pendingfetchs.get(id) : undefined;
      if (id && pending) {
        void this.pendingfetchs.delete(id);
        void pending.cleanup();
        void pending.resolve(detail);
        return;
      }

      void this.eventTarget.dispatchEvent(
        new CustomEvent("message", { detail }),
      );
    });

    socket.onclose = () => {
      if (this.webSocket === socket) this.webSocket = null;

      for (const pending of this.pendingfetchs.values()) {
        void pending.cleanup();
        void pending.reject(new Error("Station client closed"));
      }
      void this.pendingfetchs.clear();
    };

    socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      void this.messageHandler.ingest(event.data);
    };
  }

  /**
   * Sends a message to the base station without waiting for a response.
   *
   * @param message The message to send.
   */
  invoke(message: ActorMessage) {
    if (this.isClosed) return;

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;

    try {
      void this.webSocket.send(encode(message));
    } catch {}
  }

  /**
   * Sends a request to the base station and resolves with the corresponding response message.
   *
   * @param message The message to send.
   * @param options Options that control cancellation and timeout.
   * @returns A promise that resolves with the response message, or `false` when the request cannot be issued.
   */
  transact(
    message: BaseStationClientTransactMessage,
    options: BaseStationClientTransactOptions = {},
  ): Promise<BaseStationMessage | false> {
    if (this.isClosed) return Promise.resolve(false);

    const id = globalThis.crypto.randomUUID();
    const { signal, ttlMs } = options;

    return new Promise<BaseStationMessage | false>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const abortReason = () =>
        signal?.reason ??
        new DOMException("The operation was aborted.", "AbortError");

      if (signal?.aborted) {
        void reject(abortReason());
        return;
      }

      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        void resolve(false);
        return;
      }

      const handleAbort = () => {
        void this.pendingfetchs.delete(id);
        if (timeoutId) void clearTimeout(timeoutId);
        void signal?.removeEventListener("abort", handleAbort);

        void reject(abortReason());
      };

      void this.pendingfetchs.set(id, {
        resolve,
        reject,
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
          signal?.removeEventListener("abort", handleAbort);
        },
      });
      void signal?.addEventListener("abort", handleAbort, { once: true });

      if (ttlMs) {
        timeoutId = setTimeout(() => {
          void this.pendingfetchs.delete(id);
          void signal?.removeEventListener("abort", handleAbort);
          void resolve(false);
        }, ttlMs);
      }

      try {
        switch (message.kind) {
          case "iceServers": {
            void this.webSocket.send(
              encode({
                ...message,
                detail: { ...message.detail, id },
              }),
            );
            break;
          }
          case "checkoutStatus":
          case "invoiceStatus": {
            void this.webSocket.send(
              encode({
                ...message,
                detail: { ...message.detail, id },
              }),
            );
            break;
          }
        }
      } catch {
        const pending = this.pendingfetchs.get(id);
        void this.pendingfetchs.delete(id);
        void pending?.cleanup();
        void resolve(false);
      }
    });
  }

  /**
   * Closes the client and releases its local and remote resources.
   */
  close(): void {
    this.isClosed = true;
    try {
      void this.webSocket?.close(1000, "closed");
    } catch {}

    this.webSocket = null;
    for (const pending of this.pendingfetchs.values()) {
      void pending.cleanup();
      void pending.reject(new Error("Station client closed"));
    }
    void this.pendingfetchs.clear();
  }

  /**
   * Appends an event listener for events whose type attribute value is `type`.
   *
   * @param type The event type to listen for.
   * @param listener The callback that receives the event.
   * @param options An options object that specifies characteristics about the event listener.
   */
  addEventListener<K extends keyof BaseStationClientEventMap>(
    type: K,
    listener: BaseStationClientEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  /**
   * Removes an event listener previously registered with {@link addEventListener}.
   *
   * @param type The event type to remove.
   * @param listener The callback to remove.
   * @param options An options object that specifies characteristics about the event listener.
   */
  removeEventListener<K extends keyof BaseStationClientEventMap>(
    type: K,
    listener: BaseStationClientEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions,
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }
}
