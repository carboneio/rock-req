import type { Agent, ClientRequest, IncomingMessage, OutgoingHttpHeaders } from 'http'
import type { RequestOptions as HttpsRequestOptions } from 'https'
import type { ParsedUrlQueryInput } from 'querystring'
import type { Readable, Writable } from 'stream'

declare namespace rock {
  /** An error of the request. `code` is set on network errors (`ECONNRESET`, `ETIMEDOUT`, `EUNEXPECTEDUPGRADE`...) */
  interface RockError extends Error {
    code?: string
  }

  /**
   * Called once. Check `err` first: `res` and `data` are undefined when `err` is set, except on a JSON parse error
   * (then `res` is the response and `data` the raw Buffer). They are typed as always set, so a success handler needs no `!`.
   */
  type Callback<T = any> = (err: RockError | null, res: IncomingMessage, data: T) => void

  /** Must return a new Readable stream on each call (it is called again on retries and redirects) */
  type BodyFunction = (opts: ResolvedOptions) => Readable
  /** Body of a request without `json`: sent as is */
  type RawBody = string | Uint8Array | BodyFunction
  /** Body of a request with `json: true`: stringified, except a body function. A stream must be returned by a function */
  type JsonBody = { [key: string]: any, pipe?: never } | string | number | boolean | BodyFunction

  /** Options of NodeJS `http.request` / `https.request`, plus the rock-req options */
  interface Options extends Omit<HttpsRequestOptions, 'agent' | 'headers'> {
    /** Absolute URL (sets `protocol`, `hostname`, `port`, `auth` and `path`), or a path relative to `hostname` */
    url?: string | null
    /** Request headers, merged with the default headers. Names are lowercased */
    headers?: OutgoingHttpHeaders
    /** Request body. An object is accepted only with `json: true` */
    body?: RawBody | JsonBody
    /** Form data, sent as `application/x-www-form-urlencoded` */
    form?: string | ParsedUrlQueryInput
    /** Stringifies the request body and parses the response (`data` is `null` if the body is empty). Default: false */
    json?: boolean
    /** Set `false` to get the raw Buffer even with `json: true`. It never enables the parsing alone. Default: true */
    jsonResponse?: boolean
    /** Must return a new Writable stream on each call (retries). The response is piped into it, `data` is then an empty Buffer (`null` with `json`) */
    output?: (opts: ResolvedOptions, res: IncomingMessage) => Writable
    /** Decompresses gzip, deflate and br responses. Only `false` disables it. Default: true */
    decompress?: boolean
    /** Follows redirects. Default: true */
    followRedirects?: boolean
    /** Maximum number of redirects. Default: 10 */
    maxRedirects?: number
    /** Number of retries on network errors and `retryOnCode` (`maxRetry: 2` = 3 requests max). Default: 1 */
    maxRetry?: number
    /** Initial retry delay in ms, doubled on each retry, plus jitter. Default: 10 */
    retryDelay?: number
    /** Maximum retry delay in ms. A longer `Retry-After` is not retried. Default: 2000 */
    retryMaxDelay?: number
    /** HTTP status codes to retry. Default: [408, 429, 502, 503, 504, 521, 522, 524] */
    retryOnCode?: number[]
    /** Error codes to retry. Default: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN'] */
    retryOnError?: string[]
    /** Called on each request, redirect and retry. Must return the options */
    beforeRequest?: (opts: ResolvedOptions) => Options
    /** Used only if `agent.protocol` matches the request protocol ('http:' or 'https:'). Otherwise, or if false, rock-req uses its own keep-alive agent */
    agent?: Agent | false
    /** Set by rock-req: retries left (already decremented on a retry) */
    remainingRetry?: number
    /** Set by rock-req: redirects left */
    remainingRedirects?: number
    /** Set by rock-req: error of the previous attempt, on a retry */
    prevError?: RockError
    /** Set by rock-req: HTTP status code of the previous attempt, on a retry or a redirect */
    prevStatusCode?: number
  }

  /** The options given to `beforeRequest`, `output` and a body function: the defaults are already applied */
  interface ResolvedOptions extends Options {
    headers: OutgoingHttpHeaders
    maxRedirects: number
    maxRetry: number
    retryDelay: number
    retryOnCode: number[]
    retryOnError: string[]
    remainingRetry: number
    remainingRedirects: number
  }

  /** Options accepted by `extend` only (a new instance creates its own http agents) */
  interface ExtendOptions extends Options {
    /** Initial delay of TCP keep-alive probes in ms. 0 disables keep-alive. Default: 3000 */
    keepAliveDuration?: number
    /** Closes an idle keep-alive socket after this duration in ms. 0 never closes it. Default: 5000 */
    keepAliveTimeout?: number
    /** Lowercase headers removed on a redirect to another host or from https to http. Default: ['authorization', 'cookie', 'proxy-authorization', 'x-auth-token'] */
    sensitiveHeaders?: string[]
  }

  /** Default options of an instance. Change a field to change it for the next requests (not recommended, prefer `extend`) */
  interface Defaults extends Options {
    headers: OutgoingHttpHeaders
    maxRedirects: number
    maxRetry: number
    retryDelay: number
    retryOnCode: number[]
    retryOnError: string[]
    beforeRequest: (opts: ResolvedOptions) => Options
    /** Read when the instance is created: use `extend` to change it */
    readonly keepAliveDuration: number
    /** Read when the instance is created: use `extend` to change it */
    readonly keepAliveTimeout?: number
    /** Read when the instance is created: use `extend` to change it */
    readonly sensitiveHeaders?: string[]
  }

  /** Options of the shortcuts: `method` and `json` are set by the shortcut */
  type ShortcutOptions = Omit<Options, 'method' | 'json'>

  interface Response<T> {
    response: IncomingMessage
    data: T
  }

  /** `get`, `post`... : `data` is always a Buffer */
  interface Method {
    (opts: ShortcutOptions | string, cb: Callback<Buffer>): ClientRequest
    (opts: ShortcutOptions | string, body: RawBody, cb: Callback<Buffer>): ClientRequest
  }

  /** `getJSON`, `postJSON`... : `data` is the parsed JSON (`null` if the body is empty) */
  interface JsonMethod {
    <T = any>(opts: ShortcutOptions | string, cb: Callback<T>): ClientRequest
    <T = any>(opts: ShortcutOptions | string, body: JsonBody, cb: Callback<T>): ClientRequest
  }

  /** Options of the promise shortcuts: the body must be the second argument (a `body` inside the options would be ignored) */
  type PromiseOptions = Omit<ShortcutOptions, 'body'>
  type PromiseMethod = (opts: PromiseOptions | string, body?: RawBody) => Promise<Response<Buffer>>
  type PromiseJsonMethod = <T = any>(opts: PromiseOptions | string, body?: JsonBody) => Promise<Response<T>>

  interface Rock {
    /** `data` is a Buffer, or the parsed JSON with `json: true` */
    (opts: Options | string, cb: Callback): ClientRequest
    (opts: Options | string, body: RawBody | JsonBody, cb: Callback): ClientRequest

    get: Method
    post: Method
    put: Method
    patch: Method
    head: Method
    delete: Method
    getJSON: JsonMethod
    postJSON: JsonMethod
    putJSON: JsonMethod
    patchJSON: JsonMethod
    headJSON: JsonMethod
    deleteJSON: JsonMethod

    promises: {
      get: PromiseMethod
      post: PromiseMethod
      put: PromiseMethod
      patch: PromiseMethod
      head: PromiseMethod
      delete: PromiseMethod
      getJSON: PromiseJsonMethod
      postJSON: PromiseJsonMethod
      putJSON: PromiseJsonMethod
      patchJSON: PromiseJsonMethod
      headJSON: PromiseJsonMethod
      deleteJSON: PromiseJsonMethod
    }

    /** Same as calling rock directly */
    concat: Rock
    /** Default options of this instance */
    readonly defaults: Defaults
    /** Creates a new instance with its own http agents. The options are merged with the built-in defaults */
    extend (defaultOptions?: ExtendOptions): Rock
  }
}

declare const rock: rock.Rock
export = rock
