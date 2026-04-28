import { OpaqueIdentifier } from "@sovereignbase/cryptosuite";
import type { AppContext, StripeInvoiceStatus } from "../../.types/index.js";
import { fetchStripeSecretKey } from "../index.js";

export async function fetchStripeInvoiceStatus(
  ctx: AppContext["executionCtx"] | DurableObjectState<{}>,
  env: AppContext["env"],
  clientId: OpaqueIdentifier,
  invoiceId: string,
): Promise<StripeInvoiceStatus | false> {
  const stripeSecretKey = await fetchStripeSecretKey(env, ctx, clientId);
  if (!stripeSecretKey) return false;

  const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });

  if (!res.ok) return false;

  const invoice = (await res.json()) as {
    status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  };

  return invoice.status;
}
