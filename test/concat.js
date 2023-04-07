const rock = require('../')
const http = require('http')
const str = require('string-to-stream')
const test = require('tape')
const { Writable } = require('stream')

test('rock.concat (post, stream body, and json option)', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    req.pipe(res)
  })

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      url: 'http://localhost:' + port,
      body: () => str('{"a": "b"}'),
      method: 'POST',
      json: true
    }
    rock.concat(opts, function (err, res, data) {
      t.error(err)
      t.equal(typeof data, 'object')
      t.deepEqual(Object.keys(data), ['a'])
      t.equal(data.a, 'b')
      server.close()
    })
  })
})

test('should return an error if the input stream is not created by a function', function (t) {
  t.plan(2)
  const opts = {
    url: 'http://localhost:',
    body: str('{"a": "b"}'),
    method: 'POST',
    json: true
  }
  rock.concat(opts, function (err, res, data) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'opts.body must be a function returning a Readable stream. RTFM')
  })
})

test('should return an error if the output stream is not created by a function', function (t) {
  t.plan(2)
  const chunks = []
  const opts = {
    url: 'http://localhost',
    output: new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } }),
    method: 'GET'
  }
  rock.concat(opts, function (err, res, data) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'opts.output must be a function returning a Writable stream. RTFM')
  })
})

test('should return an error if the output stream is something else than a function', function (t) {
  t.plan(2)
  const opts = {
    url: 'http://localhost',
    output: 'sdsd',
    method: 'GET'
  }
  rock.concat(opts, function (err, res, data) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'opts.output must be a function returning a Writable stream. RTFM')
  })
})

test('rock.concat', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.end('blah blah blah')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock.concat('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.ok(Buffer.isBuffer(data), '`data` is type buffer')
      t.equal(data.toString(), 'blah blah blah')
      server.close()
    })
  })
})

test('should concat multiple parts', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.write('12345')
    setTimeout(() => {
      res.end('6789')
    }, 1000)
  })

  server.listen(0, function () {
    const port = server.address().port
    rock.concat('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.ok(Buffer.isBuffer(data), '`data` is type buffer')
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('rock.concat json', function (t) {
  t.plan(3)
  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.end('{"message":"response"}')
  })

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      url: 'http://localhost:' + port + '/path',
      json: true
    }
    rock.concat(opts, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.message, 'response')
      server.close()
    })
  })
})

test('rock.concat json error', function (t) {
  t.plan(1)
  const server = http.createServer(function (req, res) {
    res.statusCode = 500
    res.end('not json')
  })

  server.listen(0, function () {
    const port = server.address().port
    const opts = {
      url: 'http://localhost:' + port + '/path',
      json: true
    }
    rock.concat(opts, function (err, res, data) {
      t.ok(err instanceof Error)
      server.close()
    })
  })
})
