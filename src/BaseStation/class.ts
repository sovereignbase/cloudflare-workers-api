import { encode } from "@msgpack/msgpack";
import { DurableObject } from "cloudflare:workers";
import { ActorMessageHandler } from "../ActorMessageHandler/class.js";
import {
  blockIPAddress,
  fetchStripeCheckoutStatus,
  fetchStripeInvoiceStatus,
  generateIceServers,
} from "../.helpers/index.js";
import { BaseStationMessage } from "../.types/index.js";
import Stripe from "stripe";

export class BaseStation extends DurableObject<Env> {
  private ipAddress: string;
  private clientId: string;
  private stripe: Stripe;
  private actor: WebSocket;

  async fetch(request: Request): Promise<Response> {
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();

    this.actor = serverWebSocket;
    void this.ctx.acceptWebSocket(serverWebSocket);

    void this.ctx.waitUntil(
      (async () => {
        this.ipAddress = request.headers.get("cf-connecting-ip") ?? "";
        this.clientId = new URL(request.url).pathname.slice(1)[0];

        //VIOLATION HANDLER
        void ActorMessageHandler.addEventListener(
          "violation",
          async ({ detail }) => {
            void this.actor.close();

            const ruleId = await blockIPAddress(
              this.env,
              this.ipAddress,
              detail,
            );
            void (await this.ctx.storage.put("ruleId", ruleId));

            void (await this.ctx.storage.setAlarm(Date.now() + 60_000));
          },
        );

        //RESOURCE BACKUP HANDLER
        void ActorMessageHandler.addEventListener(
          "resourceBackup",
          ({ detail }) => {
            void this.env.CIPHER_STORE.put(`/${detail.id}`, detail.buffer, {
              httpMetadata: {
                contentType: "application/msgpack",
              },
            });
          },
        );

        //ICE SERVERS REQUEST HANDLER
        void ActorMessageHandler.addEventListener(
          "iceServers",
          async ({ detail }) => {
            const iceServers = await generateIceServers(this.env);
            void this.actor.send(
              encode({
                kind: "iceServers",
                detail: {
                  id: detail.id,
                  iceServers,
                },
              } satisfies BaseStationMessage),
            );
          },
        );

        // CHECKOUT STATUS REQUEST
        void ActorMessageHandler.addEventListener(
          "checkoutStatus",
          async ({ detail }) => {
            const checkoutStatus = await fetchStripeCheckoutStatus(
              this.ctx,
              this.env,
              this.clientId,
              detail.checkoutSessionId,
            );
            void this.actor.send(
              encode({
                kind: "checkoutStatus",
                detail: {
                  id: detail.id,
                  checkoutStatus,
                },
              } satisfies BaseStationMessage),
            );
          },
        );

        // INVOICE STATUS REQUEST
        void ActorMessageHandler.addEventListener(
          "invoiceStatus",
          async ({ detail }) => {
            const invoiceStatus = await fetchStripeInvoiceStatus(
              this.ctx,
              this.env,
              this.clientId,
              detail.invoiceId,
            );
            void this.actor.send(
              encode({
                kind: "invoiceStatus",
                detail: {
                  id: detail.id,
                  invoiceStatus,
                },
              } satisfies BaseStationMessage),
            );
          },
        );
      })(),
    );

    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  async signal(message: unknown) {
    void this.actor.send(encode(message));
  }

  async alarm() {
    const token = await this.env.IP_BLOCK_TOKEN.get();

    const ruleId = await this.ctx.storage.get("ruleId");

    void fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.env.ZONE_ID}/firewall/access_rules/rules/${ruleId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    void this.ctx.storage.delete("ruleId");
  }

  webSocketClose(socket: WebSocket) {}

  webSocketError(socket: WebSocket, error: unknown) {}

  webSocketMessage(sender: WebSocket, message: ArrayBuffer) {
    void ActorMessageHandler.ingest(message);
  }
}
