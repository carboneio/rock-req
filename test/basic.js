const rock = require('../')
const http = require('http')
const selfSignedHttps = require('self-signed-https')
const test = require('tape')

test('simple get', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://localhost:' + port + '/path', function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('https', function (t) {
  t.plan(4)

  const server = selfSignedHttps(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'https://localhost:' + port + '/path',
      rejectUnauthorized: false
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('simple get json', function (t) {
  t.plan(5)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    t.equal(req.headers.accept, 'application/json')
    res.statusCode = 200
    res.end('{"message":"response"}')
  })

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      url: 'http://localhost:' + port + '/path',
      json: true
    }
    rock(opts, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(JSON.stringify(data), '{"message":"response"}')
      server.close()
    })
  })
})

test('HEAD request', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'HEAD')
    // Taken from real-world response from HEAD request to GitHub.com
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('content-encoding', 'gzip')
    res.setHeader('connection', 'close')
    res.statusCode = 200
    req.pipe(res)
  })

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      method: 'HEAD',
      url: 'http://localhost:' + port
    }
    rock.head(opts, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 200)
      server.close()
    })
  })
})

test('timeout option', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    setTimeout(function () {
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 2000)
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'http://localhost:' + port + '/path',
      timeout: 1000,
      maxRetry: 0
    }, function (err, res) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'TimeoutError')
      server.close()
    })
  })
})

test('should not timeout even if keepAliveDuration is lower than response time', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    setTimeout(function () {
      res.end('response')
    }, 2000)
  })

  const _newRock = rock.extend({keepAliveDuration : 1000});

  server.listen(0, function () {
    const port = server.address().port
    _newRock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 0
    }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('rewrite POST redirects to GET', function (t) {
  t.plan(7)

  let redirected = false

  const server = http.createServer(function (req, res) {
    if (redirected) {
      t.equal(req.url, '/getthis')
      t.equal(req.method, 'GET')
      t.notOk(req.headers['content-length'])
      res.statusCode = 200
      req.pipe(res)
    } else {
      t.equal(req.method, 'POST')
      redirected = true
      res.statusCode = 301
      res.setHeader('Location', '/getthis')
      res.end()
    }
  })
  server.setTimeout(1000) // NodeJS < 19 does not close keep-alive socket automatically

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      method: 'POST',
      body: '123',
      url: 'http://localhost:' + port
    }
    rock(opts, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), '')
      server.close()
    })
  })
})

test('simple get hostname + url', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({ host: 'localhost', port, url: '/path' }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})
