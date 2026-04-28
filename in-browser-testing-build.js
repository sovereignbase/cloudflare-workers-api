import { build } from 'esbuild'
import { readFile } from 'fs/promises'

const config = JSON.parse(await readFile('wrangler.json'))

await build({
  entryPoints: ['./in-browser-testing-libs.ts'],
  outfile: './index.js',
  bundle: true,
  treeShaking: true,
  external: ['cloudflare:workers'],
  platform: 'browser',
  format: 'esm',
  define: {
    clientId: JSON.stringify(config.vars.ADMIN_CLIENT_ID),
  },
})
