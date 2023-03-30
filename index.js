/*! simple-get. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
module.exports = extend()

const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')
const zlib = require('zlib')
const { pipeline , Writable} = require('stream');

const isStream = o => o !== null && typeof o === 'object' && typeof o.pipe === 'function'

function extend(defaultOptions) {
  var _default = {
    headers       : {},
    maxRedirects  : 10,
    maxRetry      : 2,
    retryDelay    : 100, //ms
    retryOnCode   : [408, 429, 500, 502, 503, 504, 521, 522, 524 ],
    retryOnError  : ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED','EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN' ],
    beforeRequest : (parsedURL, retryCounter) => {return parsedURL}
  }
  _default = Object.assign(_default, defaultOptions); // inherits of parent options

  // all options https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_http_request_url_options_callback
  function simpleGet (opts, cb) {
    opts = Object.assign({ maxRedirects: _default.maxRedirects, maxRetry: _default.maxRetry }, typeof opts === 'string' ? { url: opts } : opts)
    opts.remainingRetry = opts.remainingRetry ?? opts.maxRetry;
    opts.remainingRedirects = opts.remainingRedirects ?? opts.maxRedirects;

    if (opts.url) {
      const { hostname, port, protocol, auth, path } = url.parse(opts.url) // eslint-disable-line node/no-deprecated-api
      delete opts.url
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
      body = opts.json && !isStream(opts.body) ? JSON.stringify(opts.body) : opts.body
    } else if (opts.form) {
      body = typeof opts.form === 'string' ? opts.form : querystring.stringify(opts.form)
      opts.headers['content-type'] = 'application/x-www-form-urlencoded'
    }

    if (body) {
      if (!opts.method) opts.method = 'POST'
      if (!isStream(body)) opts.headers['content-length'] = Buffer.byteLength(body)
      if (opts.json && !opts.form) opts.headers['content-type'] = 'application/json'
    }
    delete opts.body; delete opts.form

    if (opts.json) opts.headers.accept = 'application/json'
    if (opts.method) opts.method = opts.method.toUpperCase()

    const originalHost = opts.hostname // hostname before potential redirect
    const protocol = opts.protocol === 'https:' ? https : http // Support http/https urls
    const chunks = [];
    let silenceError = false;
    let response = null;
    function onRequestEnd(err) {
      silenceError = true;
      if (_default.retryOnError.indexOf(err?.code) !== -1 && --opts.remainingRetry > 0) {
        return setTimeout(simpleGet, _default.retryDelay, opts, cb)  // retry in 100ms
      }
      if (err) return cb(err)
      let data = Buffer.concat(chunks);
      if (opts.json) {
        try { data = JSON.parse(data.toString()) }
        catch (e) { return cb(e, response, data) }
      }
      // TODO test if reponse = null ????
      cb(null, response, data)
    }
    const req = protocol.request(opts, res => {
      // retry and leave
      if (res.statusCode > 400 /* speed up */ && _default.retryOnCode.indexOf(res.statusCode) !== -1 && --opts.remainingRetry > 0) {
        silenceError = true // req.removeListener('error', onRequestEnd); // TODO emitter.removeListener('close', listener)#
        res.resume() // Discard response, consume data until the end to free up memory
        return setTimeout(simpleGet, _default.retryDelay, opts, cb) // retry later
      }

      // or redirect and leave
      if (opts.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        silenceError = true // req.removeListener('error', onRequestEnd); // TODO emitter.removeListener('close', listener)#
        res.resume() // Discard response, consume data until the end to free up memory
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
          delete opts.headers['content-length']; delete opts.headers['content-type']
        }

        if (opts.remainingRedirects-- === 0) return onRequestEnd(new Error('too many redirects'))
        else return simpleGet(opts, cb)
      }

      // or read response
      response = res;
      const contentEncoding = opts.method !== 'HEAD' ? (res.headers['content-encoding'] || '').toLowerCase() : '';
      const output = new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
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
      // we must destroy manually. The error even will be fired to call the callback.
      // https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_http_request_url_options_callback
      const _error = new Error('TimeoutError'); _error.code = 'ETIMEDOUT';
      req.destroy(_error)
    })
    req.once('error',  (e) => {
      if (silenceError === false) {
        onRequestEnd(e)
      }
      // Force clean-up, because some packages (e.g. nock) don't do this.
      req.destroy()
    });
    // TODO maage stream  body
    if (isStream(body)) body.on('error', cb).pipe(req)
    else req.end(body)

    return req /// TODO remove ?
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
