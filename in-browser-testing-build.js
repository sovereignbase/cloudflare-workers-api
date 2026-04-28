import { build } from 'esbuild'
import wrangler from './wrangler.jsonc' assert { type: 'json' }

const config = JSON.parse(wrangler)

await build({
  entryPoints: ['./in-browser-testing-libs.ts'],
  outfile: './index.js',
  bundle: true,
  external: [],
  platform: 'browser',
  format: 'esm',
  define: {
    clientId: JSON.stringify(config.vars.ADMIN_CLIENT_ID),
  },
})
