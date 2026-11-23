import type { Agent, ClientRequest, IncomingMessage } from 'http'
import type { RequestOptions as HttpsRequestOptions } from 'https'
import type { Readable, Writable } from 'stream'

declare namespace rock {
  /** An error of the request. `code` is set on network errors (`ECONNRESET`, `ETIMEDOUT`, `EUNEXPECTEDUPGRADE`...) */
  interface RockError extends Error {
    code?: string
  }

  /**
   * Called once. `res` and `data` are set on success, and also with the error when a JSON response cannot be parsed.
   * `data` is a Buffer, or the parsed JSON (`null` if the body is empty) when `json` is true.
   */
  type Callback<T = any> = (err: RockError | null, res?: IncomingMessage, data?: T) => void

  /** Options of NodeJS `http.request` / `https.request`, plus the rock-req options */
  interface Options extends Omit<HttpsRequestOptions, 'agent'> {
    /** The destination URL. Overrides `protocol`, `hostname`, `port`, `auth` and `path` */
    url?: string | null
    /** Request body. With `json: true`, an object is stringified. A function must return a new Readable stream on each call (retries) */
    body?: string | Buffer | object | ((opts: Options) => Readable)
    /** Form data, sent as `application/x-www-form-urlencoded` */
    form?: string | object
    /** Stringifies the request body and parses the response. Default: false */
    json?: boolean
    /** Forces the JSON parsing of the response (or not), even if `json` is true. Default: same as `json` */
    jsonResponse?: boolean
    /** Must return a new Writable stream on each call (retries). The response is piped into it, `data` is then empty */
    output?: (opts: Options, res: IncomingMessage) => Writable
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
    beforeRequest?: (opts: Options) => Options
    /** An http(s) Agent. Replaced by the rock-req keep-alive agent if its protocol does not match the request */
    agent?: Agent
    /** Set by rock-req: retries left (already decremented on a retry) */
    remainingRetry?: number
    /** Set by rock-req: redirects left */
    remainingRedirects?: number
    /** Set by rock-req: error of the previous attempt, on a retry */
    prevError?: RockError
    /** Set by rock-req: HTTP status code of the previous attempt, on a retry or a redirect */
    prevStatusCode?: number
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

  interface Response<T = any> {
    response: IncomingMessage
    data: T
  }

  interface Method {
    (opts: Options | string, cb: Callback): ClientRequest
    (opts: Options | string, body: Options['body'], cb: Callback): ClientRequest
  }
  type PromiseMethod = <T = any>(opts: Options | string, body?: Options['body']) => Promise<Response<T>>

  interface Rock extends Method {
    get: Method
    post: Method
    put: Method
    patch: Method
    head: Method
    delete: Method
    getJSON: Method
    postJSON: Method
    putJSON: Method
    patchJSON: Method
    headJSON: Method
    deleteJSON: Method

    promises: {
      get: PromiseMethod
      post: PromiseMethod
      put: PromiseMethod
      patch: PromiseMethod
      head: PromiseMethod
      delete: PromiseMethod
      getJSON: PromiseMethod
      postJSON: PromiseMethod
      putJSON: PromiseMethod
      patchJSON: PromiseMethod
      headJSON: PromiseMethod
      deleteJSON: PromiseMethod
    }

    /** Same as calling rock directly */
    concat: Rock
    /** Default options of this instance (not recommended, prefer `extend`) */
    defaults: ExtendOptions
    /** Creates a new instance which inherits the options of this one */
    extend (defaultOptions?: ExtendOptions): Rock
  }
}

declare const rock: rock.Rock
export = rock
