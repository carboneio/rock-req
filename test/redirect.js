const rock = require('../')
const http = require('http')
const selfSignedHttps = require('./cert/self-signed-https')
const test = require('tape')
const str = require('string-to-stream')

test('follow redirects (up to 10)', function (t) {
  t.plan(14)

  let num = 0
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/' + num, 'visited /' + num)

    if (num < 10) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      res.statusCode = 200
      res.end('response')
    }
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock('http://127.0.0.1:' + port + '/0', function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('do not follow redirects', function (t) {
  t.plan(2)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/0', 'visited /0')
    res.statusCode = 301
    res.setHeader('Location', '/1')
    res.end()
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/0',
      maxRedirects: 0
    }, function (err) {
      t.ok(err instanceof Error, 'got error')
      server.close()
    })
  })
})

test('do not follow redirects and do not error', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/0', 'visited /0')

    res.statusCode = 301
    res.setHeader('Location', '/1')
    res.end()
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/0',
      followRedirects: false
    }, function (err, res) {
      t.ok(!err, 'got no error')
      t.equal(res.statusCode, 301, 'status code 301')
      t.equal(res.headers.location, '/1', 'redirect location')
      server.close()
    })
  })
})

test('follow redirects (11 is too many)', function (t) {
  t.plan(12)

  let num = 0
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/' + num, 'visited /' + num)

    if (num < 11) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      t.fail('no request to /11 should be made, should error first')
    }
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock('http://127.0.0.1:' + port + '/0', function (err) {
      t.ok(err instanceof Error, 'got error')
      server.close()
    })
  })
})

test('redirect https to http', function (t) {
  t.plan(5)

  let httpPort = null
  let httpsPort = null

  const httpsServer = selfSignedHttps(function (req, res) {
    t.equal(req.url, '/path1')
    res.statusCode = 301
    res.setHeader('Location', 'http://127.0.0.1:' + httpPort + '/path2')
    res.end()
  })

  const httpServer = http.createServer(function (req, res) {
    t.equal(req.url, '/path2')
    res.statusCode = 200
    res.end('response')
  })

  httpsServer.listen(0, '127.0.0.1', function () {
    httpsPort = httpsServer.address().port
    httpServer.listen(0, '127.0.0.1', function () {
      httpPort = httpServer.address().port
      rock({
        url: 'https://127.0.0.1:' + httpsPort + '/path1',
        rejectUnauthorized: false
      }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        httpsServer.close()
        httpServer.close()
      })
    })
  })
})

test('redirect http to https', function (t) {
  t.plan(5)

  let httpsPort = null
  let httpPort = null

  const httpServer = http.createServer(function (req, res) {
    t.equal(req.url, '/path1')
    res.statusCode = 301
    res.setHeader('Location', 'https://127.0.0.1:' + httpsPort + '/path2')
    res.end()
  })

  const httpsServer = selfSignedHttps(function (req, res) {
    t.equal(req.url, '/path2')
    res.statusCode = 200
    res.end('response')
  })

  httpServer.listen(0, '127.0.0.1', function () {
    httpPort = httpServer.address().port
    httpsServer.listen(0, '127.0.0.1', function () {
      httpsPort = httpsServer.address().port
      rock({
        url: 'http://127.0.0.1:' + httpPort + '/path1',
        rejectUnauthorized: false
      }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        httpsServer.close()
        httpServer.close()
      })
    })
  })
})

test('redirect to different host/port', function (t) {
  t.plan(6)

  let port1 = null
  let port2 = null

  const server1 = http.createServer(function (req, res) {
    t.equal(req.url, '/path1')
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer(function (req, res) {
    t.equal(req.url, '/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2)
    t.equal(req.headers.host, `127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  server1.listen(0, '127.0.0.1', function () {
    port1 = server1.address().port
    server2.listen(0, '127.0.0.1', function () {
      port2 = server2.address().port
      rock({ url: 'http://localhost:' + port1 + '/path1', family: 4 }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        server1.close()
        server2.close()
      })
    })
  })
})

test('redirect should clear explicitly specified `host` header', function (t) {
  t.plan(7)

  let port1 = null
  let port2 = null

  const server1 = http.createServer(function (req, res) {
    t.equal(req.url, '/path1')
    t.equal(req.headers.host, `localhost:${port1}`)
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer(function (req, res) {
    t.equal(req.url, '/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2), i.e.
    // that the explicitly specified `Host` header was cleared upon redirect.
    t.equal(req.headers.host, `127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  server1.listen(0, '127.0.0.1', function () {
    port1 = server1.address().port
    server2.listen(0, '127.0.0.1', function () {
      port2 = server2.address().port
      rock({
        url: `http://localhost:${port1}/path1`,
        family: 4, // family 4: localhost is only 127.0.0.1, a second host name for the same server
        // Explicitly specify a `Host` header, so it won't be set automatically
        headers: {
          host: `localhost:${port1}`
        }
      }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        server1.close()
        server2.close()
      })
    })
  })
})

test('redirect should clear explicitly specified `Host` (note uppercase) header', function (t) {
  t.plan(7)

  let port1 = null
  let port2 = null

  const server1 = http.createServer(function (req, res) {
    t.equal(req.url, '/path1')
    t.equal(req.headers.host, `localhost:${port1}`)
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer(function (req, res) {
    t.equal(req.url, '/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2), i.e.
    // that the explicitly specified `Host` header was cleared upon redirect.
    t.equal(req.headers.host, `127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  server1.listen(0, '127.0.0.1', function () {
    port1 = server1.address().port
    server2.listen(0, '127.0.0.1', function () {
      port2 = server2.address().port
      rock({
        url: `http://localhost:${port1}/path1`,
        family: 4, // family 4: localhost is only 127.0.0.1, a second host name for the same server
        // Explicitly specify a `Host` header, so it won't be set automatically
        headers: {
          Host: `localhost:${port1}`
        }
      }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        server1.close()
        server2.close()
      })
    })
  })
})

test('follow redirects without "url" option', function (t) {
  t.plan(14)

  let num = 0
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/' + num, 'visited /' + num)

    if (num < 10) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      res.statusCode = 200
      res.end('response')
    }
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({ hostname: '127.0.0.1', port, path: '/0' }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

// Redirect server: /redirect answers `statusCode` to /target which echoes the request
function startRedirectServer (statusCode, cb) {
  const server = http.createServer(function (req, res) {
    if (req.url === '/redirect') {
      req.resume()
      res.statusCode = statusCode
      res.setHeader('Location', '/target')
      return res.end()
    }
    let body = ''
    req.on('data', function (chunk) { body += chunk })
    req.on('end', function () {
      res.end(JSON.stringify({ method: req.method, body, length: req.headers['content-length'], type: req.headers['content-type'], custom: req.headers['x-custom'] }))
    })
  })
  server.listen(0, '127.0.0.1', function () { cb(server, 'http://127.0.0.1:' + server.address().port + '/redirect') })
}

;['POST', 'PUT', 'PATCH', 'DELETE'].forEach(function (method) {
  test('303 redirect changes ' + method + ' to GET and drops the body', function (t) {
    t.plan(2)
    startRedirectServer(303, function (server, url) {
      rock({ url, method, body: 'payload', headers: { 'content-type': 'text/plain', 'x-custom': 'kept' } }, function (err, res, data) {
        t.error(err)
        t.deepEqual(JSON.parse(data), { method: 'GET', body: '', custom: 'kept' })
        server.close()
      })
    })
  })
})

test('303 redirect changes a JSON POST with a stream body to GET', function (t) {
  t.plan(2)
  startRedirectServer(303, function (server, url) {
    rock.postJSON({ url, body: () => str('{"a":1}') }, function (err, res, data) {
      t.error(err)
      t.equal(data.method, 'GET')
      server.close()
    })
  })
})

;['GET', 'HEAD'].forEach(function (method) {
  test('303 redirect keeps ' + method, function (t) {
    t.plan(2)
    let visited = null
    const server = http.createServer(function (req, res) {
      if (req.url === '/redirect') {
        res.statusCode = 303
        res.setHeader('Location', '/target')
        return res.end()
      }
      visited = req.method
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rock({ url: 'http://127.0.0.1:' + server.address().port + '/redirect', method }, function (err) {
        t.error(err)
        t.equal(visited, method)
        server.close()
      })
    })
  })
})

;[301, 302].forEach(function (statusCode) {
  test(statusCode + ' redirect still changes POST to GET (unchanged)', function (t) {
    t.plan(2)
    startRedirectServer(statusCode, function (server, url) {
      rock({ url, method: 'POST', body: 'payload', headers: { 'content-type': 'text/plain' } }, function (err, res, data) {
        t.error(err)
        t.deepEqual(JSON.parse(data), { method: 'GET', body: '' })
        server.close()
      })
    })
  })

  test(statusCode + ' redirect still keeps PUT and its body (unchanged)', function (t) {
    t.plan(2)
    startRedirectServer(statusCode, function (server, url) {
      rock({ url, method: 'PUT', body: 'payload', headers: { 'content-type': 'text/plain' } }, function (err, res, data) {
        t.error(err)
        t.deepEqual(JSON.parse(data), { method: 'PUT', body: 'payload', length: '7', type: 'text/plain' })
        server.close()
      })
    })
  })
})

;[307, 308].forEach(function (statusCode) {
  ;['POST', 'PUT'].forEach(function (method) {
    test(statusCode + ' redirect keeps ' + method + ' and its body (unchanged)', function (t) {
      t.plan(2)
      startRedirectServer(statusCode, function (server, url) {
        rock({ url, method, body: 'payload', headers: { 'content-type': 'text/plain' } }, function (err, res, data) {
          t.error(err)
          t.deepEqual(JSON.parse(data), { method, body: 'payload', length: '7', type: 'text/plain' })
          server.close()
        })
      })
    })
  })
})

;['ftp://x/', 'http://127.0.0.1:99999/', 'http://[::1/x'].forEach(function (location) {
  test('invalid redirect location ' + location + ' returns an error in the callback, without crashing', function (t) {
    t.plan(2)
    const server = http.createServer(function (req, res) {
      res.statusCode = 302
      res.setHeader('Location', location)
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rock('http://127.0.0.1:' + server.address().port + '/', function (err) {
        t.ok(err instanceof Error, err && err.code)
        setTimeout(function () { t.pass('callback called once'); server.close() }, 50)
      })
    })
  })
})

test('an invalid retry returns an error in the callback, without crashing', function (t) {
  t.plan(2)
  let nb = 0
  const server = http.createServer(function (req, res) {
    res.statusCode = 503
    res.end()
  })
  server.listen(0, '127.0.0.1', function () {
    rock({
      url: 'http://127.0.0.1:' + server.address().port + '/',
      beforeRequest: function (opts) { if (nb++ === 1) opts.port = 99999; return opts }
    }, function (err) {
      t.equal(err.code, 'ERR_SOCKET_BAD_PORT')
      setTimeout(function () { t.pass('callback called once'); server.close() }, 50)
    })
  })
})

test('an invalid initial request still throws synchronously (unchanged, like http.request)', function (t) {
  t.plan(3)
  t.throws(function () { rock('ftp://x/', function () { t.fail() }) }, { code: 'ERR_INVALID_PROTOCOL' })
  t.throws(function () { rock('http://127.0.0.1:99999/', function () { t.fail() }) }, { code: 'ERR_SOCKET_BAD_PORT' })
  t.throws(function () { rock({ url: 'http://127.0.0.1:1/', headers: { a: 'x\r\nb: y' } }, function () { t.fail() }) }, { code: 'ERR_INVALID_CHAR' })
})

const credentials = { authorization: 'Bearer a', cookie: 'c=1', 'proxy-authorization': 'Basic b', 'X-Auth-Token': 'swift', 'x-custom': 'kept' }
function credentialsOf (req) {
  const h = req.headers
  return [h.authorization, h.cookie, h['proxy-authorization'], h['x-auth-token'], h['x-custom']].join()
}

function startTarget (cb) {
  const target = http.createServer(function (req, res) {
    let body = ''
    req.on('data', function (chunk) { body += chunk })
    req.on('end', function () { res.end(JSON.stringify({ method: req.method, body, credentials: credentialsOf(req) })) })
  })
  target.listen(0, '127.0.0.1', function () { cb(target, target.address().port) })
}

test('redirect to another host drops credentials headers', function (t) {
  t.plan(3)
  startTarget(function (target, targetPort) {
    const server = http.createServer(function (req, res) {
      t.equal(credentialsOf(req), 'Bearer a,c=1,Basic b,swift,kept')
      res.statusCode = 302
      res.setHeader('Location', 'http://127.0.0.1:' + targetPort + '/')
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rock({ url: 'http://localhost:' + server.address().port + '/', family: 4, headers: credentials }, function (err, res, data) {
        t.error(err)
        t.equal(JSON.parse(data).credentials, ',,,,kept')
        server.close(); target.close()
      })
    })
  })
})

test('redirect to the same host keeps credentials headers (unchanged)', function (t) {
  t.plan(2)
  startTarget(function (target, targetPort) {
    const server = http.createServer(function (req, res) {
      res.statusCode = 302
      res.setHeader('Location', 'http://127.0.0.1:' + targetPort + '/')
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rock({ url: 'http://127.0.0.1:' + server.address().port + '/', headers: credentials }, function (err, res, data) {
        t.error(err)
        t.equal(JSON.parse(data).credentials, 'Bearer a,c=1,Basic b,swift,kept')
        server.close(); target.close()
      })
    })
  })
})

test('redirect from https to http on the same host drops credentials headers', function (t) {
  t.plan(2)
  startTarget(function (target, targetPort) {
    const server = selfSignedHttps(function (req, res) {
      res.statusCode = 302
      res.setHeader('Location', 'http://127.0.0.1:' + targetPort + '/')
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rock({ url: 'https://127.0.0.1:' + server.address().port + '/', headers: credentials, rejectUnauthorized: false }, function (err, res, data) {
        t.error(err)
        t.equal(JSON.parse(data).credentials, ',,,,kept')
        server.close(); target.close()
      })
    })
  })
})

;[307, 308].forEach(function (statusCode) {
  test(statusCode + ' redirect to another host keeps the method and the body, but drops credentials headers', function (t) {
    t.plan(2)
    startTarget(function (target, targetPort) {
      const server = http.createServer(function (req, res) {
        req.resume()
        res.statusCode = statusCode
        res.setHeader('Location', 'http://127.0.0.1:' + targetPort + '/')
        res.end()
      })
      server.listen(0, '127.0.0.1', function () {
        rock({ url: 'http://localhost:' + server.address().port + '/', family: 4, method: 'POST', body: 'payload', headers: credentials }, function (err, res, data) {
          t.error(err)
          t.deepEqual(JSON.parse(data), { method: 'POST', body: 'payload', credentials: ',,,,kept' })
          server.close(); target.close()
        })
      })
    })
  })
})

test('sensitiveHeaders can be changed with extend', function (t) {
  t.plan(2)
  const rockCustom = rock.extend({ sensitiveHeaders: ['x-custom'] })
  startTarget(function (target, targetPort) {
    const server = http.createServer(function (req, res) {
      res.statusCode = 302
      res.setHeader('Location', 'http://127.0.0.1:' + targetPort + '/')
      res.end()
    })
    server.listen(0, '127.0.0.1', function () {
      rockCustom({ url: 'http://localhost:' + server.address().port + '/', family: 4, headers: credentials }, function (err, res, data) {
        t.error(err)
        t.equal(JSON.parse(data).credentials, 'Bearer a,c=1,Basic b,swift,')
        server.close(); target.close()
      })
    })
  })
})
