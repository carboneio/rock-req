const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')
const zlib = require('zlib')
const { Writable } = require('stream')

const isStream = o => o !== null && typeof o === 'object' && typeof o.pipe === 'function'
const isFnStream = o => o instanceof Function
function applyDefault (t, d) { for (const a in d) { if (t[a] === undefined) t[a] = d[a] } return t }
function cloneLowerCase (s) { const n = {}; for (const a in s) { n[a.toLowerCase()] = s[a] } return n }
const destroy = http.ClientRequest.prototype.destroy
function abort (err) { this.rockAborted = true; return destroy.call(this, err) } // req.destroy() or req.abort() by the user: never retried
function sweep (agent) { // destroy the free sockets idle for too long, then wake up for the next one. In-flight sockets are not in freeSockets
  const now = Date.now()
  let next = Infinity
  for (const name in agent.freeSockets) {
    for (const socket of agent.freeSockets[name]) {
      if (socket.rockIdleEnd <= now) socket.destroy()
      else if (socket.rockIdleEnd < next) next = socket.rockIdleEnd
    }
  }
  agent.rockSweep = next === Infinity ? undefined : setTimeout(sweep, next - now, agent).unref()
  agent.rockSweepAt = next
}
function retryAfter (res) { // RFC 9110 §10.2.3: delay-seconds or HTTP-date, in ms. Missing, invalid or past: 0
  const h = res.statusCode === 429 || res.statusCode === 503 ? res.headers['retry-after'] : undefined
  const ms = h === undefined ? 0 : /^\d+$/.test(h) ? h * 1000 : Date.parse(h) - Date.now()
  return ms > 0 ? ms : 0
}

function extend (defaultOptions = {}) {
  let _default = {
    headers: { 'accept-encoding': 'gzip, deflate, br' },
    maxRedirects: 10,
    maxRetry: 1,
    retryDelay: 10, // ms, doubled on each retry, plus jitter
    keepAliveDuration: 3000, // ms
    retryOnCode: [408, 429, 502, 503, 504, 521, 522, 524],
    retryOnError: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN'],
    beforeRequest: o => o
  }
  defaultOptions.headers = applyDefault(cloneLowerCase(defaultOptions.headers), _default.headers)
  _default = applyDefault(defaultOptions, _default) // inherits of parent options
  const idleTimeout = Number(_default.keepAliveTimeout ?? 5000) // ms, like Node's globalAgent. Like decompress (true), not in defaults: not copied in each request (faster)
  const sensitiveHeaders = _default.sensitiveHeaders ?? ['authorization', 'cookie', 'proxy-authorization', 'x-auth-token'] // dropped on redirect to another host or from https to http
  const agents = [http, https].map(h => {
    if (!(_default.keepAliveDuration > 0)) return undefined
    class RockAgent extends h.Agent {
      keepSocketAlive (socket) { // the socket goes to the free pool. No socket.setTimeout per request (slow): one sweep timer per agent
        if (super.keepSocketAlive(socket) === false) return false
        const hint = socket._httpMessage?.res?.headers['keep-alive'] // server hint minus 1s, like Node
        const timeout = hint === undefined ? idleTimeout : Math.min(idleTimeout, (/^timeout=(\d+)/.exec(hint)?.[1] ?? Infinity) * 1000 - 1000)
        if (timeout <= 0) return false
        socket.rockIdleEnd = Date.now() + timeout
        if (this.rockSweep === undefined || socket.rockIdleEnd < this.rockSweepAt) {
          clearTimeout(this.rockSweep)
          this.rockSweep = setTimeout(sweep, timeout, this).unref()
          this.rockSweepAt = socket.rockIdleEnd
        }
        return true
      }
    }
    return new (idleTimeout > 0 ? RockAgent : h.Agent)({ keepAlive: true, keepAliveMsecs: _default.keepAliveDuration })
  })

  function retry (opts, cb, wait = 0) { // failure only: retryDelay * 2^n + jitter, capped by retryMaxDelay, at least Retry-After
    const d = opts.retryDelay * 2 ** (opts.maxRetry - opts.remainingRetry - 1)
    setTimeout(next, Math.max(wait, Math.min(opts.retryMaxDelay ?? 2000, d + Math.random() * d)), opts, cb)
  }
  function next (opts, cb) { // retry or redirect: called from an event handler, so an invalid request (bad location, port...) must not throw
    let called = false
    try { rock(opts, (err, res, data) => { called = true; return cb(err, res, data) }) } catch (e) { if (called) throw e; cb(e) } // an exception of the caller's callback is not swallowed, never a second call
  }

  function rock (opts, directBody, cb) {
    if (typeof opts === 'string') opts = { url: opts }
    if (!cb) { cb = directBody } else { opts.body = directBody }
    const headers = cloneLowerCase(opts.headers)
    if (headers.range !== undefined && headers['accept-encoding'] === undefined) headers['accept-encoding'] = 'identity' // a range of the compressed body cannot be decompressed
    opts.headers = applyDefault(headers, _default.headers)
    opts = applyDefault(opts, _default)
    opts.remainingRetry = opts.remainingRetry ?? opts.maxRetry
    opts.remainingRedirects = opts.remainingRedirects ?? opts.maxRedirects

    if (opts.url) {
      const { hostname, port, protocol, auth, path } = url.parse(opts.url) // eslint-disable-line node/no-deprecated-api
      if (!hostname && !port && !protocol && !auth) opts.path = path // Relative path with hostname set
      else Object.assign(opts, { hostname, port, protocol, auth, path }) // Absolute redirect
    }
    const originalRequest = { hostname: opts.hostname, port: opts.port, protocol: opts.protocol, auth: opts.auth, path: opts.path }
    opts = opts.beforeRequest(opts)

    let body
    if (opts.body) {
      body = opts.json && !isFnStream(opts.body) && !isStream(opts.body) ? JSON.stringify(opts.body) : opts.body
    } else if (opts.form) {
      body = typeof opts.form === 'string' ? opts.form : querystring.stringify(opts.form)
      opts.headers['content-type'] = 'application/x-www-form-urlencoded'
    }
    if (body) {
      if (isStream(body)) return cb(new Error('opts.body must be a function returning a Readable stream. RTFM'))
      if (!opts.method) opts.method = 'POST'
      if (!isFnStream(body)) opts.headers['content-length'] = Buffer.byteLength(body)
      if (opts.json && !opts.form) opts.headers['content-type'] = 'application/json'
    }
    if (opts.output && (isStream(opts.output) || !isFnStream(opts.output))) return cb(new Error('opts.output must be a function returning a Writable stream. RTFM'))
    if (opts.json) opts.headers.accept = 'application/json'
    if (opts.method) opts.method = opts.method.toUpperCase()
    if (!opts.agent || opts.agent.protocol !== opts.protocol) opts.agent = (opts.protocol === 'https:' ? agents[1] : agents[0])

    const protocol = opts.protocol === 'https:' ? https : http // Support http/https urls
    const chunks = []
    const streamToCleanOnError = []
    let requestAbortedOrEnded = false
    let response = null
    function onRequestEnd (err) {
      if (requestAbortedOrEnded === true) return
      requestAbortedOrEnded = true
      if (err) {
        const aborted = req.rockAborted === true // read before destroying the streams below (req included)
        streamToCleanOnError.forEach(s => s.destroy(err))
        if (aborted === false && opts.retryOnError.indexOf(err?.code) !== -1 && opts.remainingRetry-- > 0) {
          opts.prevError = err
          return retry(opts, cb)
        }
        return cb(err)
      }
      let data = Buffer.concat(chunks)
      if (opts.json && opts.jsonResponse !== false) {
        try { data = data.length > 0 ? JSON.parse(data.toString()) : null } catch (e) { return cb(e, response, data) }
      }
      cb(null, response, data)
    }
    function listen (stream, isLast = false) {
      streamToCleanOnError.push(stream)
      stream.on('error', onRequestEnd) // do not use once()! A stream can emit mutiple error event
      stream.once('close', () => {
        if (stream.readableEnded === false || stream.writableEnded === false) return onRequestEnd(new Error('ERR_STREAM_PREMATURE_CLOSE'))
        if (isLast === true) return onRequestEnd()
      })
      return stream
    }
    const req = protocol.request(opts, res => {
      opts.prevStatusCode = res.statusCode
      let retryWait
      // retry and leave
      if (res.statusCode > 400 /* speed up */ && opts.retryOnCode.indexOf(res.statusCode) !== -1 && (retryWait = retryAfter(res)) <= (opts.retryMaxDelay ?? 2000) && opts.remainingRetry-- > 0) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
        return retry(opts, cb, retryWait) // retry later
      }
      // or redirect and leave
      if (opts.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
        delete opts.headers.host // Discard `host` header on redirect (see #32)
        opts.url = res.headers.location
        let redirectTo
        try { redirectTo = url.parse(opts.url) } catch (e) { return cb(e) } // eslint-disable-line node/no-deprecated-api
        if (redirectTo.hostname === null) { // relative redirect
          opts.url = null
          Object.assign(opts, originalRequest)
          opts.path = redirectTo.path
        } else if (redirectTo.hostname !== originalRequest.hostname || (redirectTo.protocol === 'http:' && originalRequest.protocol === 'https:')) {
          for (const h of sensitiveHeaders) delete opts.headers[h] // other host or https to http: drop credentials (#73). The body of a 307/308 is still sent
        }
        if ((opts.method === 'POST' && [301, 302].includes(res.statusCode)) || (res.statusCode === 303 && opts.method && opts.method !== 'GET' && opts.method !== 'HEAD')) {
          opts.method = 'GET' // On 301/302 redirect, change POST to GET (see #35). On 303, change all methods except HEAD to GET (RFC 9110)
          delete opts.headers['content-length']; delete opts.headers['content-type']; delete opts.body; delete opts.form
        }
        if (opts.remainingRedirects-- === 0) {
          requestAbortedOrEnded = false
          return onRequestEnd(new Error('too many redirects'))
        }
        return next(opts, cb)
      }
      // or read response and leave at the end
      response = res
      const status = res.statusCode // no body (HEAD, 204, 205, 304. Node never gives 1xx here) or a range of the compressed body (206): never decompress
      const contentEncoding = opts.decompress !== false && opts.method !== 'HEAD' && status !== 204 && status !== 205 && status !== 206 && status !== 304 ? (res.headers['content-encoding'] || '').toLowerCase() : ''
      const output = opts.output ? opts.output(opts, res) : new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
      switch (contentEncoding) {
        case 'br':
          listen(res).pipe(listen(zlib.createBrotliDecompress())).pipe(listen(output, true)); break
        case 'gzip':
        case 'x-gzip':
        case 'deflate':
          listen(res).pipe(listen(zlib.createUnzip())).pipe(listen(output, true)); break
        default:
          listen(res).pipe(listen(output, true)); break
      }
    })
    req.destroy = abort
    req.once('timeout', () => {
      const _error = new Error('TimeoutError'); _error.code = 'ETIMEDOUT'
      destroy.call(req, _error) // we must destroy manually and send the error to the error listener to call onRequestEnd. Not a user abort: retried
    })

    if (isFnStream(body) === true) listen(body(opts)).pipe(listen(req))
    else listen(req).end(body)

    return req
  }

  rock.promises = {};
  ;['get', 'post', 'put', 'patch', 'head', 'delete', 'getJSON', 'postJSON', 'putJSON', 'patchJSON', 'headJSON', 'deleteJSON'].forEach(method => {
    const jsonShortcut = /JSON$/.test(method) === true
    const methodShortcut = jsonShortcut === true ? method.toUpperCase().slice(0, -4) : method.toUpperCase()
    rock[method] = (opts, body, cb) => {
      if (typeof opts === 'string') opts = { url: opts }
      opts.method = methodShortcut
      opts.json = jsonShortcut
      return rock(opts, body, cb)
    }
    rock.promises[method] = (opts, body) => {
      return new Promise((resolve, reject) => {
        rock[method](opts, body, (err, response, data) => {
          if (err) return reject(err)
          resolve({ response, data })
        })
      })
    }
  })
  rock.concat = rock
  rock.defaults = _default
  rock.extend = extend
  return rock
}

module.exports = extend()
