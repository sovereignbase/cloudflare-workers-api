import { OpaqueIdentifier } from '@sovereignbase/cryptosuite'
import type { AppContext, StripeCheckoutStatus } from '../../.types/index.js'
import { fetchStripeSecretKey } from '../index.js'

/**
 * Fetches a Stripe Checkout Session payment status for an ANBS client.
 *
 * @param ctx The Worker or Durable Object execution context used by secret key lookup.
 * @param env The Cloudflare Worker environment bindings.
 * @param clientId The opaque ANBS client identifier.
 * @param checkoutSessionId The Stripe Checkout Session id.
 * @returns The Stripe checkout payment status, or `false` when it cannot be fetched.
 */
export async function fetchStripeCheckoutStatus(
  ctx: AppContext['executionCtx'] | DurableObjectState<{}>,
  env: AppContext['env'],
  clientId: OpaqueIdentifier,
  checkoutSessionId: string
): Promise<StripeCheckoutStatus | false> {
  const stripeSecretKey = await fetchStripeSecretKey(env, ctx, clientId)
  if (!stripeSecretKey) return false

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}`,
    {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    }
  )

  if (!res.ok) return false

  const checkout = (await res.json()) as {
    payment_status: StripeCheckoutStatus
  }

  return checkout.payment_status
}
