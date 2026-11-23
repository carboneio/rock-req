// Type tests of index.d.ts, checked by `npm run test:types` (never executed)
import rock = require('../')
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import type { ClientRequest, IncomingMessage } from 'http'

// callback, with or without body
const req: ClientRequest = rock('http://example.com', (err, res, data) => {
  if (err) { const code: string | undefined = err.code; return code }
  const status: number | undefined = res?.statusCode
  return [status, data]
})
req.on('upgrade', () => {})
rock({ url: 'http://example.com', method: 'POST' }, 'body', () => {})
rock.get('http://example.com', (err) => err)
rock.post({ url: 'http://example.com' }, Buffer.from('x'), () => {})
rock.postJSON('http://example.com', { a: 1 }, (err, res, data) => [err, res, data])
rock.concat('http://example.com', () => {})

// all options
rock({
  url: 'https://example.com',
  headers: { 'user-agent': 'x' },
  body: () => Readable.from(['a']),
  output: (opts, res: IncomingMessage) => createWriteStream('/tmp/x'),
  json: true,
  jsonResponse: false,
  decompress: false,
  followRedirects: false,
  maxRedirects: 2,
  maxRetry: 0,
  retryDelay: 10,
  retryMaxDelay: 100,
  retryOnCode: [503],
  retryOnError: ['ECONNRESET'],
  timeout: 1000,
  rejectUnauthorized: false,
  beforeRequest: (opts) => {
    const isRetry: boolean = (opts.remainingRetry ?? 0) < (opts.maxRetry ?? 0)
    const prev = [opts.prevError?.code, opts.prevStatusCode, isRetry]
    opts.hostname = String(prev.length)
    return opts
  }
}, () => {})
rock({ url: 'http://example.com', form: { a: 'b' } }, () => {})

// promises
async function promises (): Promise<void> {
  const { response, data } = await rock.promises.get('http://example.com')
  const status: number | undefined = response.statusCode
  const typed = await rock.promises.getJSON<{ id: number }>({ url: 'http://example.com' })
  const id: number = typed.data.id
  await rock.promises.post('http://example.com', 'body')
  return void [status, data, id]
}
void promises

// extend
const instance = rock.extend({ keepAliveDuration: 0, keepAliveTimeout: 1000, sensitiveHeaders: ['x-secret'], headers: { a: 'b' } })
instance.getJSON('http://example.com', () => {})
instance.extend().get('http://example.com', () => {})
rock.defaults.maxRetry = 2

// errors expected
// @ts-expect-error a callback is required
rock('http://example.com')
// @ts-expect-error output must be a function
rock({ url: 'http://example.com', output: createWriteStream('/tmp/x') }, () => {})
// @ts-expect-error maxRetry is a number
rock({ url: 'http://example.com', maxRetry: '1' }, () => {})
// @ts-expect-error unknown method
rock.download('http://example.com', () => {})
