const rock = require('../')
const http = require('http')
const test = require('tape')

test('basic auth', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.headers.authorization, 'Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock('http://foo:bar@localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('basic auth + host', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.headers.authorization, 'Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({ auth: 'foo:bar', host: 'localhost', port }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('basic auth + hostname', function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.headers.authorization, 'Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, function () {
    const port = server.address().port
    rock({ auth: 'foo:bar', hostname: 'localhost', port }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})
