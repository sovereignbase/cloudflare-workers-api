import { encode } from "@msgpack/msgpack";
import { DurableObject } from "cloudflare:workers";
import { ActorMessageHandler } from "@sovereignbase/actor-message-handler";

export class BaseStation extends DurableObject<Env> {
  private ipAddress: string;
  private billingId: string;
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
      })(),
    );

    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  async resourceMessage(message: unknown) {
    this.actor.send(encode(message));
  }

  async webSocketMessage(sender: WebSocket, message: ArrayBuffer) {
    void ActorMessageHandler.ingest(message);
  }

  webSocketClose(socket: WebSocket) {}

  webSocketError(socket: WebSocket, error: unknown) {}

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
}
