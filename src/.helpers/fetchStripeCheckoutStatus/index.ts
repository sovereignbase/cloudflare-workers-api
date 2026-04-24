import { OpaqueIdentifier } from "@sovereignbase/cryptosuite";
import type { AppContext, StripeCheckoutStatus } from "../../.types/index.js";
import { fetchStripeSecretKey } from "../index.js";

export async function fetchStripeCheckoutStatus(
  ctx: AppContext["executionCtx"],
  env: AppContext["env"],
  clientId: OpaqueIdentifier,
  checkoutSessionId: string,
): Promise<StripeCheckoutStatus | false> {
  const stripeSecretKey = await fetchStripeSecretKey(env, ctx, clientId);
  if (!stripeSecretKey) return false;

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}`,
    {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    },
  );

  if (!res.ok) return false;

  const checkout = (await res.json()) as {
    payment_status: StripeCheckoutStatus;
  };

  return checkout.payment_status;
}
