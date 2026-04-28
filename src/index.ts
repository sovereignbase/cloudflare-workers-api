import { Hono } from 'hono'
import { fromHono } from 'chanfana'
import { BaseStationResolver } from './BaseStationResolver/class.js'

/**
 * Cloudflare Worker application for ANBS base station WebSocket sessions.
 *
 * The application exposes the base station resolver at `/:clientId` and
 * delegates accepted WebSocket sessions to the `BaseStation` Durable Object.
 */
const app = new Hono<{ Bindings: Env }>()

/**
 * OpenAPI-aware Hono registry used to document the base station route.
 */
const openapi = fromHono(app)

openapi.get('/:clientId', BaseStationResolver)

export default app
export { BaseStationResolver }
export { BaseStation } from './BaseStation/class.js'
export { BaseStationClient } from './BaseStationClient/index.js'
export { BaseStationMessageHandler } from './BaseStationMessageHandler/class.js'
export { BaseStationClientMessageHandler } from './BaseStationClientMessageHandler/class.js'
export type * from './.types/index.js'
