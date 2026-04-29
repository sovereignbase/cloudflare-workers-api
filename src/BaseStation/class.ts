import { decode, encode } from '@msgpack/msgpack'
import { DurableObject } from 'cloudflare:workers'
import { BaseStationClientMessageHandler } from '../BaseStationClientMessageHandler/class.js'
import {
  blockIPAddress,
  fetchStripeCheckoutStatus,
  fetchStripeInvoiceStatus,
  generateIceServers,
} from '../.helpers/index.js'
import { BaseStationMessage } from '../.types/types.js'
import Stripe from 'stripe'
import {
  Cryptographic,
  MessageAuthenticationKey,
} from '@sovereignbase/cryptosuite'

/**
 * Cloudflare Workers implementation of ANBS base station.
 *
 * A base station owns one WebSocket session, validates and handles client
 * messages through {@link BaseStationClientMessageHandler}, and sends encoded
 * base station messages back to the connected client, usually an ANBS actor.
 */
export class BaseStation extends DurableObject<Env> {
  private ipAddress: string
  private clientId: string
  private stripe: Stripe
  private actor: WebSocket

  /**
   * Handles a WebSocket upgrade request for a base station session.
   *
   * @param request The incoming WebSocket upgrade request.
   * @returns A `101 Switching Protocols` response with the client WebSocket.
   */
  async fetch(request: Request): Promise<Response> {
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()

    this.actor = serverWebSocket
    void this.ctx.acceptWebSocket(serverWebSocket)

    void this.ctx.waitUntil(
      void (async () => {
        this.ipAddress =
          request.headers.get('cf-connecting-ip') ??
          request.headers.get('x-forwarded-for') ??
          ''
        this.clientId = new URL(request.url).pathname.slice(1)[0]

        //VIOLATION HANDLER
        void BaseStationClientMessageHandler.addEventListener(
          'violation',
          async ({ detail }) => {
            void this.actor.close()
            void this.rateLimitIP(this.ipAddress, detail)
          }
        )

        //RESOURCE BACKUP HANDLER
        void BaseStationClientMessageHandler.addEventListener(
          'cipherStorePut',
          async ({ detail }) => {
            const { id, buffer, protectedBytes, authorization } = detail

            const mac = await this.env.MACS.get(id)

            if (!mac) return

            const macBytes = await mac.arrayBuffer()

            const macKey = (await decode(macBytes)) as MessageAuthenticationKey

            const isAuthorized =
              await Cryptographic.messageAuthentication.verify(
                macKey,
                protectedBytes,
                authorization
              )

            if (!isAuthorized) {
              void this.actor.close()
              void this.rateLimitIP(this.ipAddress, 'Unauthorized write')
              return
            }

            void this.env.CIPHER_STORE.put(`/${id}`, buffer, {
              httpMetadata: {
                contentType: 'application/msgpack',
              },
            })
          }
        )

        //ICE SERVERS REQUEST HANDLER
        void BaseStationClientMessageHandler.addEventListener(
          'iceServersGet',
          async ({ detail }) => {
            const iceServers = await generateIceServers(this.env)
            void this.actor.send(
              encode({
                id: detail.id,
                kind: 'iceServers',
                detail: {
                  iceServers,
                },
              } satisfies BaseStationMessage)
            )
          }
        )

        // CHECKOUT STATUS REQUEST
        void BaseStationClientMessageHandler.addEventListener(
          'checkoutStatusGet',
          async ({ detail }) => {
            const checkoutStatus = await fetchStripeCheckoutStatus(
              this.ctx,
              this.env,
              this.clientId,
              detail.checkoutSessionId
            )
            void this.actor.send(
              encode({
                id: detail.id,
                kind: 'checkoutStatus',
                detail: {
                  checkoutStatus,
                },
              } satisfies BaseStationMessage)
            )
          }
        )

        // INVOICE STATUS REQUEST
        void BaseStationClientMessageHandler.addEventListener(
          'invoiceStatusGet',
          async ({ detail }) => {
            const invoiceStatus = await fetchStripeInvoiceStatus(
              this.ctx,
              this.env,
              this.clientId,
              detail.invoiceId
            )
            void this.actor.send(
              encode({
                id: detail.id,
                kind: 'invoiceStatus',
                detail: {
                  invoiceStatus,
                },
              } satisfies BaseStationMessage)
            )
          }
        )
      })()
    )

    return new Response(null, { status: 101, webSocket: clientWebSocket })
  }

  /**
   * Sends an already-shaped ANBS base station message to the connected client.
   *
   * @param message The message value to MessagePack-encode and send.
   */
  async signal(message: unknown): Promise<void> {
    void this.actor.send(encode(message))
  }

  /**
   * Blocks an IP address through the configured Cloudflare access rule API.
   *
   * The block rule id is stored in Durable Object storage and removed by the
   * next alarm.
   *
   * @param ipAddress The IP address to block.
   * @param detail The rule note and diagnostic reason.
   */
  async rateLimitIP(
    ipAddress: string,
    detail: string = 'Bad request'
  ): Promise<void> {
    const ruleId = await blockIPAddress(this.env, ipAddress, detail)
    void (await this.ctx.storage.put('ruleId', ruleId))

    void (await this.ctx.storage.setAlarm(Date.now() + 60_000))
  }

  /**
   * Removes the previously stored Cloudflare IP block rule.
   */
  async alarm() {
    const token = await this.env.IP_BLOCK_TOKEN.get()

    const ruleId = await this.ctx.storage.get('ruleId')

    void (await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.env.ZONE_ID}/firewall/access_rules/rules/${ruleId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    ))

    void (await this.ctx.storage.delete('ruleId'))
  }

  /**
   * Handles WebSocket close notifications from the Durable Object runtime.
   *
   * @param socket The WebSocket that closed.
   */
  webSocketClose(socket: WebSocket) {}

  /**
   * Handles WebSocket error notifications from the Durable Object runtime.
   *
   * @param socket The WebSocket that errored.
   * @param error The runtime-provided error value.
   */
  webSocketError(socket: WebSocket, error: unknown) {}

  /**
   * Ingests a binary client message received from the connected WebSocket.
   *
   * @param sender The WebSocket that sent the message.
   * @param message The MessagePack-encoded ANBS client message.
   */
  webSocketMessage(sender: WebSocket, message: ArrayBuffer) {
    void BaseStationClientMessageHandler.ingest(message)
  }
}
