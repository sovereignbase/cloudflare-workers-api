import { z } from 'zod'
import { OpenAPIRoute } from 'chanfana'
import type { AppContext } from '../.types/types.js'
import { fetchClientConfig, isAllowedOrigin } from '../.helpers/index.js'
import { Cryptographic } from '@sovereignbase/cryptosuite'

/**
 * OpenAPI route that resolves and upgrades ANBS base station client sessions.
 *
 * The resolver validates the WebSocket headers, checks client configuration,
 * verifies the request origin, and forwards accepted requests to a new
 * `BaseStation` Durable Object instance.
 */
export class BaseStationResolver extends OpenAPIRoute {
  /**
   * OpenAPI schema for the base station WebSocket upgrade endpoint.
   */
  schema = {
    tags: ['Base station', 'Sovereignbase'],
    summary: 'Upgrade to WebSocket for base station session',
    request: {
      headers: z.object({
        origin: z.string(),
        upgrade: z.string(),
        connection: z.string(),
        'cf-connecting-ip': z.string(),
        'sec-websocket-key': z.string().min(1),
        'sec-websocket-version': z.literal('13'),
      }),
      params: z.object({
        clientId: z.string().min(64),
      }),
    },
    responses: {
      '101': { description: 'WebSocket upgrade' },
      '404': {
        description: 'Not found.',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
    },
  }

  /**
   * Handles a candidate WebSocket upgrade request.
   *
   * @param context The Hono request context with Cloudflare Worker bindings.
   * @returns The Durable Object upgrade response, or a `404` response when the
   * request is not accepted.
   */
  async handle(context: AppContext) {
    const validated = await this.getValidatedData<typeof this.schema>()
    const connection = validated.headers.connection.toLowerCase()
    const upgrade = validated.headers.upgrade.toLowerCase()
    const origin = validated.headers.origin.toLowerCase()

    const clientId = validated.params.clientId

    const stub = context.env.BASE_STATION.get(
      context.env.BASE_STATION.newUniqueId()
    )

    if (
      !Cryptographic.identifier.validate(clientId) ||
      upgrade !== 'websocket' ||
      !connection.includes('upgrade')
    ) {
      void stub.rateLimitIP(validated.headers['cf-connecting-ip'])
      return context.text('Not found', 404)
    }

    if (clientId === context.env.ADMIN_CLIENT_ID) {
      if (!isAllowedOrigin(origin, context.env.ADMIN_ALLOWED_ORIGINS)) {
        void stub.rateLimitIP(validated.headers['cf-connecting-ip'])
        return context.text('Not found', 404)
      }
      return stub.fetch(context.req.raw)
    }

    const config = await fetchClientConfig(
      context.env,
      context.executionCtx,
      clientId
    )

    if (!config || !isAllowedOrigin(origin, config.allowedOrigins)) {
      void stub.rateLimitIP(validated.headers['cf-connecting-ip'])
      return context.text('Not found', 404)
    }

    return stub.fetch(context.req.raw)
  }
}
