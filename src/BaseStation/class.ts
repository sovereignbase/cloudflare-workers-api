import { encode } from "@msgpack/msgpack";
import { DurableObject } from "cloudflare:workers";
import { ActorMessageHandler } from "@sovereignbase/actor-message-handler";
import { generateIceServers } from "../.helpers";
import { BaseStationMessage } from "../.types";
import Stripe from "stripe";

export class BaseStation extends DurableObject<Env> {
  private ipAddress: string;
  private billingId: string;
  private stripe: Stripe;
  private actor: WebSocket;

  async fetch(request: Request): Promise<Response> {
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();

    this.actor = serverWebSocket;
    void this.ctx.acceptWebSocket(serverWebSocket);

    void this.ctx.waitUntil(
      (async () => {
        this.ipAddress = request.headers.get("cf-connecting-ip") ?? "";
        this.billingId = new URL(request.url).pathname.slice(1)[0];

        void ActorMessageHandler.addEventListener(
          "violation",
          async ({ detail }) => {
            void this.actor.close();

            const token = await this.env.IP_BLOCK_TOKEN.get();

            const res = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${this.env.ZONE_ID}/firewall/access_rules/rules`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  mode: "block",
                  configuration: {
                    target: "ip",
                    value: this.ipAddress,
                  },
                  notes: detail,
                }),
              },
            );

            const json = await res.json<{ result: { id: string } }>();

            void (await this.ctx.storage.put("ruleId", json.result.id));

            void (await this.ctx.storage.setAlarm(Date.now() + 60_000));
          },
        );

        void ActorMessageHandler.addEventListener("backup", ({ detail }) => {
          void this.env.RESOURCES.put(detail.id, detail.buffer);
        });

        void ActorMessageHandler.addEventListener(
          "transact",
          async ({ detail }) => {
            switch (detail) {
              case "iceServers": {
                const iceServers = await generateIceServers(this.env);
                void this.actor.send(
                  encode({
                    kind: "iceServers",
                    detail: iceServers,
                  } satisfies BaseStationMessage),
                );
              }
            }
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
