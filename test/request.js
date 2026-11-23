const rock = require('../')
const http = require('http')
const test = require('tape')

test('access `req` object', function (t) {
  t.plan(2)

  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    res.end('response')
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    const req = rock('http://127.0.0.1:' + port, function (err, res) {
      t.error(err)
      res.resume() // discard data
      server.close()
    })

    req.on('socket', function () {
      t.pass('got `socket` event')
    })
  })
})
