const rock = require('../')
const http = require('http')
const str = require('string-to-stream')
const test = require('tape')
const zlib = require('zlib')

test('custom headers', function (t) {
  t.plan(2)

  const server = http.createServer(function (req, res) {
    t.equal(req.headers['custom-header'], 'custom-value')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'http://localhost:' + port,
      headers: {
        'custom-header': 'custom-value'
      }
    }, function (err, res) {
      t.error(err)
      res.resume()
      server.close()
    })
  })
})

test('gzip response', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.setHeader('content-encoding', 'gzip')
    str('response').pipe(zlib.createGzip()).pipe(res)
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('bad gzip response', function (t) {
  t.plan(1)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.setHeader('content-encoding', 'gzip')
    const text = 'Hello World!'
    const buf = Buffer.from(text, 'utf-8')
    zlib.gzip(buf, function (err, result) {
      res.end(result.slice(0, -1))
    })
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://localhost:' + port, function (err, res, data) {
      t.ok(err instanceof Error)
      server.close()
    })
  })
})

test('deflate response', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.setHeader('content-encoding', 'deflate')
    str('response').pipe(zlib.createDeflate()).pipe(res)
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200) // statusCode still works on inflate stream
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('br response', function (t) {
  t.plan(3)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.setHeader('content-encoding', 'br')
    str('response').pipe(zlib.createBrotliCompress()).pipe(res)
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200) // statusCode still works on inflate stream
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})
