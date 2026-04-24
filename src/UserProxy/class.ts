import { DurableObject } from "cloudflare:workers";
import { encode } from "@msgpack/msgpack";

export class UserProxy extends DurableObject<Env> {
  private ipAddress: string;
  private billingId: string;
  private topics = new Set<string>();
  private user: WebSocket;
  private peerOffer = null;
  private resourceProxy = this.env.RESOURCE_PROXY;
  private serviceProxy = this.env.SERVICE_PROXY;
  async fetch(request: Request): Promise<Response> {
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    this.user = serverWebSocket;
    this.ctx.acceptWebSocket(serverWebSocket);

    this.ctx.waitUntil(
      (async () => {
        this.ipAddress = request.headers.get("cf-connecting-ip");
        this.billingId = new URL(request.url).pathname.slice(1).split("/")[0];
      })(),
    );

    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  async webSocketMessage(sender: WebSocket, message: ArrayBuffer) {
    this.resourceProxy.getByName("").subscribe(this.ctx.id.toString());
  }
  async resourceMessage(message: unknown) {
    this.user.send(encode(message));
  }

  webSocketClose(socket: WebSocket) {}

  webSocketError(socket: WebSocket, error: unknown) {}
}
