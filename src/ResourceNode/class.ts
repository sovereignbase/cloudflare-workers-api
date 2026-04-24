import { DurableObject } from "cloudflare:workers";

export class ResourceProxy extends DurableObject<Env> {
  private subscriptions = new Set<string>();
  private userProxy = this.env.USER_PROXY;
  async subscribe(durableObjectId: string): Promise<void> {
    this.subscriptions.add(durableObjectId);
  }
  async relay(topic: string, payload: unknown): Promise<void> {
    for (const subscription of this.subscriptions) {
      void this.userProxy
        .get(this.userProxy.idFromString(subscription))
        .deliver();
    }
  }
  async backup(topic: string, payload: unknown): Promise<void> {
    // fanout / broadcast
  }
}
