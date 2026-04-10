import { DurableObject } from "cloudflare:workers";
import Stripe from "stripe";

export class ServiceProxy extends DurableObject<Env> {
  private stripe: Stripe;
  private userProxy = this.env.USER_PROXY;
  async init(durableObjectId: string): Promise<void> {
    this.stripe = new Stripe(await this.env.STRIPE_SECRET_KEY.get(), {
      maxNetworkRetries: 2,
    });
  }
  async backup(topic: string, payload: unknown): Promise<void> {
    // fanout / broadcast
  }
}
