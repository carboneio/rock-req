const rock = require('../')
const http = require('http')
const str = require('string-to-stream')
const test = require('tape')
const zlib = require('zlib')
const { Writable } = require('stream')

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
  t.plan(2)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.setHeader('content-encoding', 'gzip')
    const text = 'Hello World!'
    const buf = Buffer.from(text, 'utf-8')
    zlib.gzip(buf, function (err, result) {
      t.error(err)
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

const compressors = { gzip: zlib.gzipSync, deflate: zlib.deflateSync, br: zlib.brotliCompressSync }
Object.keys(compressors).forEach(function (encoding) {
  const raw = Buffer.from('response '.repeat(100))
  const compressed = compressors[encoding](raw)
  function startServer (cb) {
    const server = http.createServer(function (req, res) {
      res.statusCode = 200
      res.setHeader('content-encoding', encoding)
      res.end(compressed)
    })
    server.listen(0, function () { cb(server, 'http://localhost:' + server.address().port) })
  }

  test(encoding + ' response with decompress = true', function (t) {
    t.plan(3)
    startServer(function (server, url) {
      rock({ url, decompress: true }, function (err, res, data) {
        t.error(err)
        t.equal(res.headers['content-encoding'], encoding)
        t.ok(data.equals(raw))
        server.close()
      })
    })
  })

  test(encoding + ' response with decompress = false returns the raw body untouched', function (t) {
    t.plan(3)
    startServer(function (server, url) {
      rock({ url, decompress: false }, function (err, res, data) {
        t.error(err)
        t.equal(res.headers['content-encoding'], encoding)
        t.ok(data.equals(compressed))
        server.close()
      })
    })
  })

  test(encoding + ' response with decompress = false and an output stream', function (t) {
    t.plan(2)
    const chunks = []
    startServer(function (server, url) {
      const output = () => new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
      rock({ url, decompress: false, output }, function (err) {
        t.error(err)
        t.ok(Buffer.concat(chunks).equals(compressed))
        server.close()
      })
    })
  })

  test(encoding + ' response with decompress = false set by extend, and overwritten per request', function (t) {
    t.plan(5)
    const rockRaw = rock.extend({ decompress: false })
    t.equal(rockRaw.defaults.decompress, false)
    startServer(function (server, url) {
      rockRaw({ url }, function (err, res, data) {
        t.error(err)
        t.ok(data.equals(compressed))
        rockRaw({ url, decompress: true }, function (err, res, data) {
          t.error(err)
          t.ok(data.equals(raw))
          server.close()
        })
      })
    })
  })
})

const gzipped = zlib.gzipSync('response '.repeat(100))
function startEncodedServer (statusCode, encoding, cb) {
  const server = http.createServer(function (req, res) {
    const noBody = statusCode === 204 || statusCode === 205 || statusCode === 304
    res.writeHead(statusCode, { 'content-encoding': encoding, 'content-length': noBody ? 0 : gzipped.length })
    res.end(req.method === 'HEAD' || noBody ? undefined : gzipped)
  })
  server.listen(0, function () { cb(server, 'http://localhost:' + server.address().port) })
}

;[204, 205, 304].forEach(function (statusCode) {
  test(statusCode + ' response with content-encoding gzip is not decompressed (no body)', function (t) {
    t.plan(4)
    startEncodedServer(statusCode, 'gzip', function (server, url) {
      rock(url, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, statusCode)
        t.equal(res.headers['content-encoding'], 'gzip')
        t.equal(data.length, 0)
        server.close()
      })
    })
  })
})

test('HEAD response with content-encoding gzip is not decompressed', function (t) {
  t.plan(3)
  startEncodedServer(200, 'gzip', function (server, url) {
    rock.head(url, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.length, 0)
      server.close()
    })
  })
})

test('206 partial response with content-encoding gzip is returned raw (a range of the compressed body)', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    const part = gzipped.subarray(10, 20)
    res.writeHead(206, { 'content-encoding': 'gzip', 'content-range': 'bytes 10-19/' + gzipped.length, 'content-length': part.length })
    res.end(part)
  })
  server.listen(0, function () {
    rock({ url: 'http://localhost:' + server.address().port, headers: { range: 'bytes=10-19' } }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 206)
      t.equal(res.headers['content-encoding'], 'gzip')
      t.ok(data.equals(gzipped.subarray(10, 20)))
      server.close()
    })
  })
})

test('200 response with content-encoding gzip is still decompressed, also when the server ignores the range header', function (t) {
  t.plan(2)
  startEncodedServer(200, 'gzip', function (server, url) {
    rock({ url, headers: { Range: 'bytes=0-1' } }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'response '.repeat(100))
      server.close()
    })
  })
})

test('range request header: send accept-encoding identity only if accept-encoding is not set', function (t) {
  t.plan(9)
  const server = http.createServer(function (req, res) {
    res.end(req.headers['accept-encoding'])
  })
  server.listen(0, function () {
    const url = 'http://localhost:' + server.address().port
    rock({ url, headers: { Range: 'bytes=0-1' } }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'identity')
      rock({ url, headers: { range: 'bytes=0-1', 'Accept-Encoding': 'gzip' } }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'gzip')
        rock(url, function (err, res, data) {
          t.error(err)
          t.equal(data.toString(), 'gzip, deflate, br', 'unchanged without range')
          const rockRaw = rock.extend({ headers: { 'accept-encoding': 'br' } })
          rockRaw({ url, headers: { range: 'bytes=0-1' } }, function (err, res, data) {
            t.error(err)
            t.equal(data.toString(), 'identity', 'the instance default accept-encoding is not explicit for this request')
            t.equal(rockRaw.defaults.headers['accept-encoding'], 'br')
            server.close()
          })
        })
      })
    })
  })
})

;['x-gzip', 'X-GZIP'].forEach(function (encoding) {
  test(encoding + ' response is decompressed like gzip', function (t) {
    t.plan(2)
    startEncodedServer(200, encoding, function (server, url) {
      rock(url, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'response '.repeat(100))
        server.close()
      })
    })
  })
})

test('x-gzip response with decompress = false is returned raw', function (t) {
  t.plan(2)
  startEncodedServer(200, 'x-gzip', function (server, url) {
    rock({ url, decompress: false }, function (err, res, data) {
      t.error(err)
      t.ok(data.equals(gzipped))
      server.close()
    })
  })
})
