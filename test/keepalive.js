const rock = require('../')
const http = require('http')
const test = require('tape')

// Count TCP connections opened/closed on server side
function startServer (handler, cb) {
  const stats = { opened: 0, closed: 0 }
  const sockets = []
  const server = http.createServer(handler)
  server.on('connection', function (socket) {
    stats.opened++
    sockets.push(socket)
    socket.on('close', function () { stats.closed++ })
  })
  server.stop = function () { server.close(); sockets.forEach(s => s.destroy()) } // Node < 18.2 has no closeAllConnections
  server.listen(0, function () { cb(server, 'http://localhost:' + server.address().port, stats) })
}

test('keepAliveTimeout and decompress are not in defaults (undefined = 5000ms and true), not copied in each request', function (t) {
  t.plan(2)
  t.equal(rock.defaults.keepAliveTimeout, undefined)
  t.equal(rock.defaults.decompress, undefined)
})

test('keepAliveTimeout: the socket is reused before the timeout', function (t) {
  t.plan(6)
  const _rock = rock.extend({ keepAliveTimeout: 300 })
  startServer(function (req, res) { res.end('ok') }, function (server, url, stats) {
    _rock(url, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'ok')
      setTimeout(function () {
        _rock(url, function (err, res, data) {
          t.error(err)
          t.equal(data.toString(), 'ok')
          t.equal(stats.opened, 1)
          t.equal(stats.closed, 0)
          server.stop()
        })
      }, 50)
    })
  })
})

test('keepAliveTimeout: an idle socket is closed by the client after the timeout', function (t) {
  t.plan(5)
  const _rock = rock.extend({ keepAliveTimeout: 200 })
  startServer(function (req, res) { res.end('ok') }, function (server, url, stats) {
    _rock(url, function (err) {
      t.error(err)
      setTimeout(function () {
        t.equal(stats.closed, 1, 'idle socket closed by the client (Node server keepAliveTimeout is 5s)')
        _rock(url, function (err, res, data) {
          t.error(err)
          t.equal(data.toString(), 'ok')
          t.equal(stats.opened, 2, 'a new socket is opened')
          server.stop()
        })
      }, 500)
    })
  })
})

test('keepAliveTimeout: does not kill a slow in-flight response on a reused socket', function (t) {
  t.plan(6)
  const _rock = rock.extend({ keepAliveTimeout: 100 })
  startServer(function (req, res) {
    if (req.url === '/fast') return res.end('fast')
    setTimeout(function () { res.end('slow') }, 500)
  }, function (server, url, stats) {
    _rock(url + '/fast', function (err) {
      t.error(err)
      _rock({ url: url + '/slow', maxRetry: 0 }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'slow')
        t.equal(stats.opened, 1, 'the socket was reused')
        t.equal(stats.closed, 0)
        // and it expires again once free
        setTimeout(function () {
          t.equal(stats.closed, 1)
          server.close()
        }, 300)
      })
    })
  })
})

test('keepAliveTimeout: does not kill a slow in-flight response on a new socket', function (t) {
  t.plan(2)
  const _rock = rock.extend({ keepAliveTimeout: 100 })
  startServer(function (req, res) {
    setTimeout(function () { res.end('slow') }, 400)
  }, function (server, url) {
    _rock({ url, maxRetry: 0 }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'slow')
      server.stop()
    })
  })
})

test('keepAliveTimeout: the request timeout option still works on a reused socket', function (t) {
  t.plan(3)
  const _rock = rock.extend({ keepAliveTimeout: 1000 })
  startServer(function (req, res) {
    if (req.url === '/fast') return res.end('fast')
    setTimeout(function () { res.end('slow') }, 400)
  }, function (server, url, stats) {
    _rock(url + '/fast', function (err) {
      t.error(err)
      _rock({ url: url + '/slow', maxRetry: 0, timeout: 100 }, function (err) {
        t.equal(err.code, 'ETIMEDOUT')
        t.equal(stats.opened, 1, 'the socket was reused')
        server.stop()
      })
    })
  })
})

test('keepAliveTimeout: the shorter server Keep-Alive hint (minus 1s) is used', function (t) {
  t.plan(3)
  const _rock = rock.extend({ keepAliveTimeout: 10000 })
  startServer(function (req, res) { res.end('ok') }, function (server, url, stats) {
    server.keepAliveTimeout = 2000 // Node sends "Keep-Alive: timeout=2", the client closes after 1s
    _rock(url, function (err, res) {
      t.error(err)
      t.equal(res.headers['keep-alive'], 'timeout=2')
      setTimeout(function () {
        t.equal(stats.closed, 1, 'closed by the client before the server')
        server.close()
      }, 1400)
    })
  })
})

test('keepAliveTimeout: the socket is not kept if the server Keep-Alive hint is too short', function (t) {
  t.plan(3)
  startServer(function (req, res) {
    res.setHeader('keep-alive', 'timeout=1')
    res.end('ok')
  }, function (server, url, stats) {
    rock(url, function (err) {
      t.error(err)
      rock(url, function (err) {
        t.error(err)
        t.equal(stats.opened, 2)
        server.stop()
      })
    })
  })
})

test('keepAliveTimeout: 0 disables the idle timeout (previous behaviour)', function (t) {
  t.plan(4)
  const _rock = rock.extend({ keepAliveTimeout: 0 })
  startServer(function (req, res) { res.end('ok') }, function (server, url, stats) {
    _rock(url, function (err) {
      t.error(err)
      setTimeout(function () {
        t.equal(stats.closed, 0)
        _rock(url, function (err) {
          t.error(err)
          t.equal(stats.opened, 1)
          server.stop()
        })
      }, 300)
    })
  })
})
