import { BaseStationClient } from './dist/index.js'

const baseStation = new BaseStationClient('')

const invoiceStatus = await baseStation.transact('invoiceStatusGet', {
  invoiceId: '',
})

if (invoiceStatus) {
  switch (invoiceStatus) {
    case 'draft':
    case 'open':
    case 'paid':
    case 'uncollectible':
    case 'void':
  }
}
