module.exports = extend()

const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')
const zlib = require('zlib')
const { pipeline , Writable, Readable, finished} = require('stream');

const isStream = o => o !== null && typeof o === 'object' && typeof o.pipe === 'function'
const isFnStream = o => o instanceof Function

function extend(defaultOptions) {
  var _default = {
    headers       : {},
    maxRedirects  : 10,
    maxRetry      : 2,
    retryDelay    : 100, //ms
    retryOnCode   : [408, 429, 500, 502, 503, 504, 521, 522, 524 ],
    retryOnError  : ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED','EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN' ],
    beforeRequest : (parsedURL, retryCounter) => { return parsedURL }
  }
  _default = Object.assign(_default, defaultOptions); // inherits of parent options

  // all options https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_http_request_url_options_callback
  function simpleGet (opts, cb) {
    opts = Object.assign({ maxRedirects: _default.maxRedirects, maxRetry: _default.maxRetry }, typeof opts === 'string' ? { url: opts } : opts)
    opts.remainingRetry = opts.remainingRetry ?? opts.maxRetry;
    opts.remainingRedirects = opts.remainingRedirects ?? opts.maxRedirects;

    if (opts.url) {
      const { hostname, port, protocol, auth, path } = url.parse(opts.url) // eslint-disable-line node/no-deprecated-api
      if (!hostname && !port && !protocol && !auth) opts.path = path // Relative redirect
      else Object.assign(opts, { hostname, port, protocol, auth, path }) // Absolute redirect
    }
    opts = _default.beforeRequest(opts)

    const headers = { 'accept-encoding': 'gzip, deflate, br' }
    if (_default.headers) Object.keys(_default.headers).forEach(k => (headers[k.toLowerCase()] = _default.headers[k]))
    if (opts.headers) Object.keys(opts.headers).forEach(k => (headers[k.toLowerCase()] = opts.headers[k]))
    opts.headers = headers

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

    const originalHost = opts.hostname // hostname before potential redirect
    const protocol = opts.protocol === 'https:' ? https : http // Support http/https urls
    const chunks = [];
    let requestAbortedOrEnded = false;
    let response = null;
    function onRequestEnd(err) {
      if (requestAbortedOrEnded === true) return;
      requestAbortedOrEnded = true;
      if (_default.retryOnError.indexOf(err?.code) !== -1 && --opts.remainingRetry > 0) {
        return setTimeout(simpleGet, _default.retryDelay, opts, cb)  // retry in 100ms
      }
      if (err) return cb(err)
      let data = Buffer.concat(chunks);
      if (opts.json) {
        try { data = JSON.parse(data.toString()) }
        catch (e) { return cb(e, response, data) }
      }
      cb(null, response, data)
    }
    const req = protocol.request(opts, res => {
      // retry and leave
      if (res.statusCode > 400 /* speed up */ && _default.retryOnCode.indexOf(res.statusCode) !== -1 && opts.remainingRetry-- > 0) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
        return setTimeout(simpleGet, _default.retryDelay, opts, cb) // retry later
      }

      // or redirect and leave
      if (opts.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
        res.resume() // Discard response, consume data until the end to free up memory. Mandatory!

        opts.url = res.headers.location // Follow 3xx redirects
        delete opts.headers.host // Discard `host` header on redirect (see #32)

        const redirectHost = url.parse(opts.url).hostname // eslint-disable-line node/no-deprecated-api
        // If redirected host is different than original host, drop headers to prevent cookie leak (#73)
        if (redirectHost !== null && redirectHost !== originalHost) {
          delete opts.headers.cookie
          delete opts.headers.authorization
        }

        if (opts.method === 'POST' && [301, 302].includes(res.statusCode)) {
          opts.method = 'GET' // On 301/302 redirect, change POST to GET (see #35)
          delete opts.headers['content-length']; delete opts.headers['content-type']; delete opts.body; delete opts.form; // TODO test dllete body/form only on 301/302
        }
        
        if (opts.remainingRedirects-- === 0) {
          requestAbortedOrEnded = false // TODO should we ignore inputStream error in this case?
          return onRequestEnd(new Error('too many redirects'))
        } 
        return simpleGet(opts, cb)
      }

      // or read response and leave at the end
      response = res;
      const contentEncoding = opts.method !== 'HEAD' ? (res.headers['content-encoding'] || '').toLowerCase() : '';

      const output = opts.output ? opts.output(opts, res) : new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
      switch (contentEncoding) {
        case 'br':
          pipeline(res, zlib.createBrotliDecompress(), output, onRequestEnd); break;
        case 'gzip':
        case 'deflate':
          pipeline(res, zlib.createUnzip(), output, onRequestEnd); break;
        default:
          pipeline(res, output, onRequestEnd); break;
      }
    })
    req.once('timeout', () => {
      const _error = new Error('TimeoutError'); _error.code = 'ETIMEDOUT';
      req.destroy() // we must destroy manually
      onRequestEnd(_error) // This timeout event can come after the input pipeline is finished (ex. timeout with no body)
    })

    // TODO TEST this : https://github.com/nodejs/node/issues/36674
    const _inputStream = isFnStream(body) ? body(opts) : Readable.from([body], {objectMode: false})
    pipeline(_inputStream, req, (e) => {
      if (e) onRequestEnd(e);
    });

    return req
  }


  ;['get', 'post', 'put', 'patch', 'head', 'delete'].forEach(method => {
    simpleGet[method] = (opts, cb) => {
      if (typeof opts === 'string') opts = { url: opts }
      return simpleGet(Object.assign({ method: method.toUpperCase() }, opts), cb)
    }
  })
  simpleGet.concat = simpleGet;
  simpleGet.defaults = _default;
  simpleGet.extend = extend;

  return simpleGet
}
