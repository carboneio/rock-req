// Type tests of index.d.ts, checked by `npm run test:types` (never executed).
// `Equals` compares exact types: a type loosened to `any` fails the check.
import rock = require('rock-req')
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { Agent, type ClientRequest, type IncomingMessage, type OutgoingHttpHeaders } from 'http'

type Equals<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false
const url = 'http://example.com'

// rock(): exact callback and return types
const req = rock(url, (err, res, data) => {
  const e: Equals<typeof err, rock.RockError | null> = true
  const r: Equals<typeof res, IncomingMessage> = true
  const d: Equals<typeof data, any> = true
  const status: number | undefined = res.statusCode // no `!` needed after checking err
  return [e, r, d, status, err?.code]
})
const reqType: Equals<typeof req, ClientRequest> = true
rock({ url, method: 'POST' }, 'body', () => {})
rock({ url, json: true }, { a: 1 }, () => {})
rock.concat(url, () => {})

// plain shortcuts: data is a Buffer
rock.get(url, (err, res, data) => { const d: Equals<typeof data, Buffer> = true; return [err, res, d] })
rock.post({ url }, Buffer.from('x'), (err, res, data) => { const d: Equals<typeof data, Buffer> = true; return d })
rock.put(url, new Uint8Array([1]), () => {})
const getReq = rock.get(url, () => {})
const getJsonReq = rock.getJSON(url, { a: 1 }, () => {})
const shortcutTypes: [Equals<typeof getReq, ClientRequest>, Equals<typeof getJsonReq, ClientRequest>] = [true, true]
void shortcutTypes
rock.post(url, () => Readable.from(['a']), () => {})
// an existing handler with explicit types is accepted
function handler (err: Error | null, res: IncomingMessage, data: Buffer): void { void [err, res, data] }
rock.get(url, handler)

// a plain shortcut with json: true gives the parsed JSON (#7)
rock.get({ url, json: true }, (err, res, data) => { const d: Equals<typeof data, any> = true; return d })
rock.get<{ id: number }>({ url, json: true }, (err, res, data) => { const d: Equals<typeof data, { id: number }> = true; return d })
rock.post({ url, json: true }, { a: 1 }, () => {})
rock.get({ url, json: false }, (err, res, data) => { const d: Equals<typeof data, Buffer> = true; return d })

// JSON shortcuts: data is the parsed JSON, typed with a generic
rock.postJSON(url, { a: 1 }, (err, res, data) => { const d: Equals<typeof data, any> = true; return d })
rock.getJSON<{ id: number }>(url, (err, res, data) => { const d: Equals<typeof data, { id: number }> = true; return d })
interface User { id: number, name: string }
const user: User = { id: 1, name: 'x' }
rock.putJSON(url, user, () => {})
rock.postJSON(url, [1, 2], () => {})

// all options
rock({
  url: 'https://example.com',
  headers: { 'user-agent': 'x', 'x-list': ['a', 'b'], 'content-length': 2 },
  body: () => Readable.from(['a']),
  form: { a: 'b', list: ['c', 'd'], n: 1 },
  output: (opts, res) => {
    const o: Equals<typeof opts, rock.ResolvedOptions> = true
    const r: Equals<typeof res, IncomingMessage> = true
    void [o, r]
    return createWriteStream('/tmp/x')
  },
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
  agent: new Agent({ keepAlive: true }),
  beforeRequest: (opts) => {
    opts.headers['x-request-id'] = '1' // headers are always an object here
    const isRetry: boolean = opts.remainingRetry < opts.maxRetry
    const prev: [string | undefined, number | undefined] = [opts.prevError?.code, opts.prevStatusCode]
    opts.hostname = String(isRetry) + prev.length
    return opts
  }
}, () => {})
rock({ url, agent: false }, () => {})
const headers: OutgoingHttpHeaders = { a: 'b' }
rock({ url, headers }, () => {})

// promises
async function promises (): Promise<void> {
  const res = await rock.promises.get(url)
  const r: Equals<typeof res, rock.Response<Buffer>> = true
  const typed = await rock.promises.getJSON<{ id: number }>({ url })
  const t: Equals<typeof typed.data, { id: number }> = true
  const anyJson = await rock.promises.postJSON(url, { a: 1 })
  const a: Equals<typeof anyJson.data, any> = true
  await rock.promises.post(url, 'body')
  await rock.promises.post({ url, body: 'in options' })
  const plainJson = await rock.promises.get<{ id: number }>({ url, json: true })
  const p: Equals<typeof plainJson.data, { id: number }> = true
  void p
  void [r, t, a]
}
void promises

// extend and defaults
const instance = rock.extend({ keepAliveDuration: 0, keepAliveTimeout: 1000, sensitiveHeaders: ['x-secret'], headers: { a: 'b' } })
const instanceType: Equals<typeof instance, rock.Rock> = true
instance.getJSON(url, () => {})
instance.extend().get(url, () => {})
rock.defaults.maxRetry = 2
rock.defaults.retryOnCode.push(500) // always set
rock.defaults.headers['x-a'] = '1'
const maxRetry: number = rock.defaults.maxRetry
void [reqType, instanceType, maxRetry]

// errors expected: each line below must be rejected
// @ts-expect-error a callback is required
rock(url)
// @ts-expect-error output must be a function returning a stream
rock({ url, output: createWriteStream('/tmp/x') }, () => {})
// @ts-expect-error maxRetry is a number
rock({ url, maxRetry: '1' }, () => {})
// @ts-expect-error unknown method
rock.download(url, () => {})
// @ts-expect-error a stream body must be returned by a function (retries)
rock({ url, body: Readable.from(['a']) }, () => {})
// @ts-expect-error a stream body must be returned by a function (retries)
rock.post(url, Readable.from(['a']), () => {})
// @ts-expect-error an object body needs json: use postJSON
rock.post(url, { a: 1 }, () => {})
// @ts-expect-error headers must be an object, not an array
rock({ url, headers: ['a', 'b'] }, () => {})
// @ts-expect-error the shortcut sets the method
rock.get({ url, method: 'POST' }, () => {})
// @ts-expect-error a JSON shortcut sets json
rock.getJSON({ url, json: false }, () => {})
// @ts-expect-error a plain shortcut gives a Buffer, not a typed object
rock.get(url, (err: Error | null, res: IncomingMessage, data: { id: number }) => [err, res, data])
// @ts-expect-error the defaults object can not be replaced
rock.defaults = rock.defaults
// @ts-expect-error extend checks its options
rock.extend({ maxRetry: '1' })
// @ts-expect-error keepAliveDuration is read when the instance is created
rock.defaults.keepAliveDuration = 0
rock({ url, agent: true }, () => {}) // like Node: the rock-req agent
// @ts-expect-error an agent must be an Agent or a boolean
rock({ url, agent: 'x' }, () => {})
// @ts-expect-error an object body needs json, also in the options
void rock.promises.post({ url, body: { a: 1 } })
// @ts-expect-error an object body needs json, also in the options
rock.post({ url, body: { a: 1 } }, () => {})

// a rejected promise carries the response and the raw body, like the callback
rock.promises.getJSON(url).catch((err: rock.RockError) => {
  const r: Equals<typeof err.response, IncomingMessage | undefined> = true
  const d: Equals<typeof err.data, Buffer | undefined> = true
  return [r, d, err.response?.statusCode]
})
