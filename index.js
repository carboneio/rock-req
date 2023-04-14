const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')
const zlib = require('zlib')
const { pipeline, Writable, Readable } = require('stream')

const isStream = o => o !== null && typeof o === 'object' && typeof o.pipe === 'function'
const isFnStream = o => o instanceof Function
function applyDefault (t, d) { for (const a in d) { if (t[a] === undefined) t[a] = d[a] } return t }
function cloneLowerCase (s) { const n = {}; for (const a in s) { n[a.toLowerCase()] = s[a] } return n }

function extend (defaultOptions = {}) {
  let _default = {
    headers: { 'accept-encoding': 'gzip, deflate, br' },
    maxRedirects: 10,
    maxRetry: 1,
    retryDelay: 10, // ms
    keepAliveDuration: 3000, // ms
    retryOnCode: [408, 429, 502, 503, 504, 521, 522, 524],
    retryOnError: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'],
    beforeRequest: o => o
  }
  defaultOptions.headers = applyDefault(cloneLowerCase(defaultOptions.headers), _default.headers)
  _default = applyDefault(defaultOptions, _default) // inherits of parent options
  const agents = [http, https].map( h => (_default.keepAliveDuration > 0 ) ? new h.Agent({ keepAlive: true, keepAliveMsecs: _default.keepAliveDuration, timeout : _default.keepAliveDuration /* remove free socket node < 19 */  }) : undefined);

  function rock (opts, directBody, cb) {
    if (typeof opts === 'string') opts = { url: opts }
    if (!cb) { cb = directBody } else { opts.body = directBody }
    opts.headers = applyDefault(cloneLowerCase(opts.headers), _default.headers)
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
    if (!opts.agent || opts.agent.protocol !== opts.protocol) opts.agent = (opts.protocol === 'https:' ? agents[1] : agents[0]);

    const protocol = opts.protocol === 'https:' ? https : http // Support http/https urls
    const chunks = []
    const streamToCleanOnError = []
    let requestAbortedOrEnded = false
    let response = null
    function onRequestEnd (err) {
      if (requestAbortedOrEnded === true) return
      requestAbortedOrEnded = true
      if (err) {
        streamToCleanOnError.forEach( s => s.destroy(err) )
        if (opts.retryOnError.indexOf(err?.code) !== -1 && --opts.remainingRetry > 0) {
          opts.prevError = err
          return setTimeout(rock, opts.retryDelay, opts, cb) // retry in 100ms
        }
        return cb(err)
      }
      let data = Buffer.concat(chunks)
      if (opts.json) {
        try { data = JSON.parse(data.toString()) } catch (e) { return cb(e, response, data) }
      }
      cb(null, response, data)
    }
    function listen (stream, isLast = false) {
      streamToCleanOnError.push(stream)
      stream.once('error', onRequestEnd)
      stream.once('close', () => {
        if (stream.readableEnded === false || stream.writableEnded === false) return onRequestEnd(new Error('ERR_STREAM_PREMATURE_CLOSE')) 
        if (isLast === true) return onRequestEnd()
      })
      return stream
    }
    const req = protocol.request(opts, res => {
      opts.prevStatusCode = res.statusCode
      // retry and leave
      if (res.statusCode > 400 /* speed up */ && opts.retryOnCode.indexOf(res.statusCode) !== -1 && opts.remainingRetry-- > 0) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
        return setTimeout(rock, opts.retryDelay, opts, cb) // retry later
      }
      // or redirect and leave
      if (opts.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
        delete opts.headers.host // Discard `host` header on redirect (see #32)
        opts.url = res.headers.location
        const redirectTo = url.parse(opts.url) // eslint-disable-line node/no-deprecated-api
        if (redirectTo.hostname === null) { // relative redirect
          opts.url = null
          Object.assign(opts, originalRequest)
          opts.path = redirectTo.path
        } else if (redirectTo.hostname !== originalRequest.hostname) { // If redirected host is different than original host, drop headers to prevent cookie leak (#73)
          delete opts.headers.cookie
          delete opts.headers.authorization
        }
        if (opts.method === 'POST' && [301, 302].includes(res.statusCode)) {
          opts.method = 'GET' // On 301/302 redirect, change POST to GET (see #35)
          delete opts.headers['content-length']; delete opts.headers['content-type']; delete opts.body; delete opts.form
        }
        if (opts.remainingRedirects-- === 0) {
          requestAbortedOrEnded = false
          return onRequestEnd(new Error('too many redirects'))
        }
        return rock(opts, cb)
      }
      // or read response and leave at the end
      response = res
      const contentEncoding = opts.method !== 'HEAD' ? (res.headers['content-encoding'] || '').toLowerCase() : ''
      const output = opts.output ? opts.output(opts, res) : new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
      switch (contentEncoding) {
        case 'br':
          listen(res).pipe(listen(zlib.createBrotliDecompress())).pipe(listen(output, true)); break
        case 'gzip':
        case 'deflate':
          listen(res).pipe(listen(zlib.createUnzip())).pipe(listen(output, true)); break
        default:
          listen(res).pipe(listen(output, true)); break
      }
    })
    req.once('timeout', () => {
      const _error = new Error('TimeoutError'); _error.code = 'ETIMEDOUT'
      req.destroy(_error) // we must destroy manually and send the error to the error listener to call onRequestEnd
    })

    if (isFnStream(body) === true) listen(body(opts)).pipe(listen(req))
    else listen(req).end(body)

    return req
  }

  ;['get', 'post', 'put', 'patch', 'head', 'delete', 'getJSON', 'postJSON', 'putJSON', 'patchJSON', 'headJSON', 'deleteJSON'].forEach(method => {
    const jsonShortcut = /JSON$/.test(method) === true
    const methodShortcut = jsonShortcut === true ? method.toUpperCase().slice(0, -4) : method.toUpperCase()
    rock[method] = (opts, body, cb) => {
      if (typeof opts === 'string') opts = { url: opts }
      opts.method = methodShortcut
      opts.json = jsonShortcut
      return rock(opts, body, cb)
    }
  })
  rock.concat = rock
  rock.defaults = _default
  rock.extend = extend
  return rock
}

module.exports = extend()
