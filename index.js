/*! simple-get. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
module.exports = extend()

const decompressResponse = require('decompress-response') // excluded from browser build
const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')

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

    const headers = { 'accept-encoding': 'gzip, deflate' }
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
    const req = protocol.request(opts, res => {
      if (res.statusCode > 400 /* speed up */ && _default.retryOnCode.indexOf(res.statusCode) !== -1 && --opts.remainingRetry > 0) {
        return setTimeout(simpleGet, _default.retryDelay, opts, cb) // retry in 100ms
      }

      if (opts.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        opts.url = res.headers.location // Follow 3xx redirects
        delete opts.headers.host // Discard `host` header on redirect (see #32)
        res.resume() // Discard response

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

        if (opts.remainingRedirects-- === 0) return cb(new Error('too many redirects'))
        else return simpleGet(opts, cb)
      }

      const tryUnzip = typeof decompressResponse === 'function' && opts.method !== 'HEAD'
      cb(null, tryUnzip ? decompressResponse(res) : res)
    })
    req.on('timeout', () => {
      // we must destroy manually. The error even will be fired to call the callback.
      // https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_http_request_url_options_callback
      const  _error = new Error('TimeoutError');
      _error.code = 'ETIMEDOUT';
      req.destroy(_error)
    })
    req.once('error',  (e) => {
      // Force clean-up, because some packages (e.g. nock) don't do this.
      req.destroy()
      if (_default.retryOnError.indexOf(e.code) !== -1 && --opts.remainingRetry > 0) {
        return setTimeout(simpleGet, _default.retryDelay, opts, cb)  // retry in 100ms
      }
      cb(e);
    });
    if (isStream(body)) body.on('error', cb).pipe(req)
    else req.end(body)

    return req
  }

  simpleGet.concat = (opts, cb) => {
    return simpleGet(opts, (err, res) => {
      if (err) return cb(err)
      simpleConcat(res, (err, data) => {
        if (err) return cb(err)
        if (opts.json) {
          try {
            data = JSON.parse(data.toString())
          } catch (err) {
            return cb(err, res, data)
          }
        }
        cb(null, res, data)
      })
    })
  }

  ;['get', 'post', 'put', 'patch', 'head', 'delete'].forEach(method => {
    simpleGet[method] = (opts, cb) => {
      if (typeof opts === 'string') opts = { url: opts }
      return simpleGet(Object.assign({ method: method.toUpperCase() }, opts), cb)
    }
  })

  function simpleConcat (stream, cb) {
    var chunks = []
    stream.on('data', function (chunk) {
      chunks.push(chunk)
    })
    stream.once('end', function () {
      if (cb) cb(null, Buffer.concat(chunks))
      cb = null
    })
    stream.once('error', function (err) {
      if (cb) cb(err)
      cb = null
    })
  }

  simpleGet.simpleConcat = simpleConcat
  simpleGet.defaults = _default;
  simpleGet.extend = extend;

  return simpleGet
}
