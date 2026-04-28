declare const clientId: OpaqueIdentifier

import type { OpaqueIdentifier } from '@sovereignbase/cryptosuite'
import { BaseStationClient } from './dist/index.js'

const protocol = window.location.protocol

const baseStation = new BaseStationClient(
  `${protocol === 'http:' ? 'http://localhost:8787' : 'https://station-client.sovereignbase.dev'}/${clientId}`
)
