import { encode, decode } from "@msgpack/msgpack";
import type {
  BaseStationClientEventListenerFor,
  BaseStationClientPendingTransact,
  BaseStationClientTransactOptions,
  BaseStationClientEventMap,
} from "../.types/index.js";

/**
 * Represents a base station client that coordinates local tab messaging and an opportunistic base station transport.
 *
 * @template T The application message shape.
 */
export class BaseStationClient<T extends Record<string, unknown>> {
  private readonly eventTarget = new EventTarget();
  private readonly webSocketUrl: string;
  private webSocket: WebSocket | null = null;
  private isClosed: boolean = false;
  private readonly pendingfetchs = new Map<
    string,
    BaseStationClientPendingTransact<T>
  >();

  /**
   * Initializes a new {@link BaseStationClient} instance.
   *
   * @param webSocketUrl The base station WebSocket URL. When omitted, the instance operates in local-only mode.
   */
  constructor(webSocketUrl: string = "") {
    this.webSocketUrl = webSocketUrl;

    if (!this.webSocketUrl) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.webSocketUrl);
    } catch {
      return;
    }

    socket.binaryType = "arraybuffer";
    this.webSocket = socket;

    socket.onopen = () => {
      this.eventTarget.dispatchEvent(new Event("open"));
    };

    socket.onerror = () => {
      this.eventTarget.dispatchEvent(new Event("error"));
    };

    socket.onclose = () => {
      if (this.webSocket === socket) this.webSocket = null;

      for (const pending of this.pendingfetchs.values()) {
        pending.cleanup();
        pending.reject(new Error("Station client closed"));
      }
      this.pendingfetchs.clear();

      this.eventTarget.dispatchEvent(new Event("close"));
    };

    socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const message = decode(event.data);
      if (!message) return;

      if (
        Array.isArray(message) &&
        message[0] === "station-client-response" &&
        typeof message[1] === "string"
      ) {
        const id = message[1];
        const pending = this.pendingfetchs.get(id);
        if (!pending) return;

        this.pendingfetchs.delete(id);
        pending.cleanup();
        pending.resolve(message[2] as T);
        return;
      }

      this.eventTarget.dispatchEvent(
        new CustomEvent("message", { detail: message as T }),
      );
    };
  }
  /**main methods*/

  /**
   * Broadcasts a message to other same-origin contexts and opportunistically forwards it to the base station.
   *
   * @param message The message to broadcast.
   */
  invoke(message: T) {
    if (this.isClosed) return;

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;

    try {
      this.webSocket.send(encode(message));
    } catch {}
  }

  /**
   * Sends a request to the base station and resolves with the corresponding response message.
   *
   * @param message The message to send.
   * @param options Options that control cancellation and stale follower cleanup.
   * @returns A promise that resolves with the response message, or `false` when the request cannot be issued.
   */
  transact(
    message: T,
    options: BaseStationClientTransactOptions = {},
  ): Promise<T | false> {
    if (this.isClosed) return Promise.resolve(false);

    const id = globalThis.crypto.randomUUID();
    const { signal, ttlMs } = options;

    return new Promise<T | false>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const abortReason = () =>
        signal?.reason ??
        new DOMException("The operation was aborted.", "AbortError");

      if (signal?.aborted) {
        reject(abortReason());
        return;
      }

      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        resolve(false);
        return;
      }

      const handleAbort = () => {
        this.pendingfetchs.delete(id);
        if (timeoutId) clearTimeout(timeoutId);
        signal?.removeEventListener("abort", handleAbort);

        reject(abortReason());
      };

      this.pendingfetchs.set(id, {
        resolve,
        reject,
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
          signal?.removeEventListener("abort", handleAbort);
        },
      });
      signal?.addEventListener("abort", handleAbort, { once: true });

      if (ttlMs) {
        timeoutId = setTimeout(() => {
          this.pendingfetchs.delete(id);
          signal?.removeEventListener("abort", handleAbort);
          resolve(false);
        }, ttlMs);
      }

      try {
        this.webSocket.send(encode(["station-client-request", id, message]));
      } catch {
        const pending = this.pendingfetchs.get(id);
        this.pendingfetchs.delete(id);
        pending?.cleanup();
        resolve(false);
      }
    });
  }

  /**
   * Closes the client and releases its local and remote resources.
   */
  close(): void {
    this.isClosed = true;
    try {
      this.webSocket?.close(1000, "closed");
    } catch {}

    this.webSocket = null;
    for (const pending of this.pendingfetchs.values()) {
      pending.cleanup();
      pending.reject(new Error("Station client closed"));
    }
    this.pendingfetchs.clear();
  }

  /**listeners*/

  /**
   * Appends an event listener for events whose type attribute value is `type`.
   *
   * @param type The event type to listen for.
   * @param listener The callback that receives the event.
   * @param options An options object that specifies characteristics about the event listener.
   */
  addEventListener<K extends keyof BaseStationClientEventMap<T>>(
    type: K,
    listener: BaseStationClientEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.eventTarget.addEventListener(
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
  removeEventListener<K extends keyof BaseStationClientEventMap<T>>(
    type: K,
    listener: BaseStationClientEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }
}
