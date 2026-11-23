const rock = require('../')
const http = require('http')
const net = require('net')
const tls = require('tls')
const test = require('tape')
const { EventEmitter } = require('events')
const selfSignedHttps = require('./cert/self-signed-https')

// A local HTTP proxy (CONNECT) counting the tunnels it opens
function startProxy (ready) {
  const proxy = http.createServer()
  proxy.tunnels = 0
  proxy.on('connect', (req, socket) => {
    proxy.tunnels++
    const [host, port] = req.url.split(':')
    const upstream = net.connect(port, host, () => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); upstream.pipe(socket); socket.pipe(upstream) })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  })
  proxy.listen(0, '127.0.0.1', () => ready(proxy, proxy.address().port))
}

// Like tunnel.httpOverHttp() or, with secure, tunnel.httpsOverHttp() (defaultPort 443, TLS in the tunnel): an EventEmitter without `protocol`
function tunnelAgent (proxyPort, secure = false) {
  const agent = new EventEmitter()
  agent.requests = 0
  if (secure === true) agent.defaultPort = 443
  agent.addRequest = (req, options) => {
    agent.requests++
    const connect = http.request({ host: '127.0.0.1', port: proxyPort, method: 'CONNECT', path: options.host + ':' + options.port, agent: false })
    connect.once('connect', (res, socket) => req.onSocket(secure === true ? tls.connect({ socket, rejectUnauthorized: false }) : socket))
    connect.once('error', (err) => req.destroy(err))
    connect.end()
  }
  return agent
}

function startServer (handler, ready) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1', () => ready(server, 'http://127.0.0.1:' + server.address().port))
}

test('an agent without protocol (tunnel, proxy agents) is used: the request goes through the proxy', function (t) {
  t.plan(4)
  startProxy((proxy, proxyPort) => {
    startServer((req, res) => res.end('via proxy'), (server, url) => {
      const agent = tunnelAgent(proxyPort)
      rock({ url, agent }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'via proxy')
        t.equal(agent.requests, 1)
        t.equal(proxy.tunnels, 1, 'never a direct connection')
        server.close(); proxy.close()
      })
    })
  })
})

test('an agent without protocol is used on a redirect and on a retry too', function (t) {
  t.plan(4)
  let nb = 0
  startProxy((proxy, proxyPort) => {
    startServer((req, res) => {
      nb++
      if (nb === 1) { res.statusCode = 302; res.setHeader('Location', '/next'); return res.end() }
      if (nb === 2) return res.socket.destroy() // network error: retried
      res.end('ok')
    }, (server, url) => {
      const agent = tunnelAgent(proxyPort)
      rock({ url, agent, retryDelay: 1 }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'ok')
        t.equal(agent.requests, 3, 'request, redirect and retry')
        t.equal(proxy.tunnels, 3)
        server.close(); proxy.close()
      })
    })
  })
})

test('an https tunnel agent (defaultPort 443) sends an https request through the proxy', function (t) {
  t.plan(4)
  startProxy((proxy, proxyPort) => {
    const httpsServer = selfSignedHttps((req, res) => res.end('secure via proxy'))
    httpsServer.listen(0, '127.0.0.1', () => {
      const agent = tunnelAgent(proxyPort, true)
      rock({ url: 'https://127.0.0.1:' + httpsServer.address().port + '/', agent }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'secure via proxy')
        t.equal(agent.requests, 1)
        t.equal(proxy.tunnels, 1)
        httpsServer.close(); proxy.close()
      })
    })
  })
})

test('an https tunnel agent with hostname and port only (no protocol) works through the proxy, as before', function (t) {
  t.plan(3)
  startProxy((proxy, proxyPort) => {
    const httpsServer = selfSignedHttps((req, res) => res.end('secure via proxy'))
    httpsServer.listen(0, '127.0.0.1', () => {
      rock({ hostname: '127.0.0.1', port: httpsServer.address().port, path: '/', agent: tunnelAgent(proxyPort, true) }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'secure via proxy')
        t.equal(proxy.tunnels, 1)
        httpsServer.close(); proxy.close()
      })
    })
  })
})

test('an http tunnel agent with an https url throws at once, like Node with an agent of the other protocol: nothing is sent', function (t) {
  t.plan(3)
  const agent = tunnelAgent(1)
  t.throws(() => rock({ url: 'https://127.0.0.1:1/', agent }, () => t.fail()), { code: 'ERR_INVALID_PROTOCOL' })
  t.throws(() => rock({ url: 'http://127.0.0.1:1/', agent: tunnelAgent(1, true) }, () => t.fail()), { code: 'ERR_INVALID_PROTOCOL' })
  t.equal(agent.requests, 0)
})

;[['http', 'https'], ['https', 'http']].forEach(([from, to]) => {
  test('a redirect from ' + from + ' to ' + to + ' with a tunnel agent ends with an error, never in cleartext, never direct, not retried', function (t) {
    t.plan(5)
    startProxy((proxy, proxyPort) => {
      let direct = 0
      const target = to === 'https' ? selfSignedHttps((req, res) => res.end('direct')) : http.createServer((req, res) => res.end('direct'))
      target.on('connection', () => direct++)
      target.listen(0, '127.0.0.1', () => {
        const location = to + '://127.0.0.1:' + target.address().port + '/'
        const first = from === 'https' ? selfSignedHttps() : http.createServer()
        first.on('request', (req, res) => { res.statusCode = 302; res.setHeader('Location', location); res.end() })
        first.listen(0, '127.0.0.1', () => {
          const agent = tunnelAgent(proxyPort, from === 'https')
          rock({ url: from + '://127.0.0.1:' + first.address().port + '/', agent, retryDelay: 1 }, function (err) {
            t.equal(err && err.code, 'ERR_INVALID_PROTOCOL')
            t.equal(agent.requests, 1, 'only the first request')
            t.equal(proxy.tunnels, 1)
            t.equal(direct, 0, 'the target never got a connection')
            setTimeout(() => { t.equal(agent.requests, 1, 'not retried'); first.close(); target.close(); proxy.close() }, 50)
          })
        })
      })
    })
  })
})

test('the caller http.Agent is used, with a url or with hostname and port only (no protocol)', function (t) {
  t.plan(6)
  startServer((req, res) => res.end('ok'), (server, url) => {
    const agent = new http.Agent()
    let used = 0
    const addRequest = agent.addRequest.bind(agent)
    agent.addRequest = (...args) => { used++; return addRequest(...args) }
    rock({ url, agent }, function (err, res, data) {
      t.error(err)
      t.equal(used, 1, 'with a url')
      rock({ hostname: '127.0.0.1', port: server.address().port, path: '/', agent }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'ok')
        t.equal(used, 2, 'with hostname and port, without protocol')
        t.equal(agent.protocol, 'http:')
        agent.destroy(); server.close()
      })
    })
  })
})

test('an agent for the other protocol is replaced by the rock-req agent (a redirect from http to https works)', function (t) {
  t.plan(3)
  const httpsServer = selfSignedHttps((req, res) => res.end('secure'))
  httpsServer.listen(0, '127.0.0.1', () => {
    startServer((req, res) => {
      res.statusCode = 302
      res.setHeader('Location', 'https://127.0.0.1:' + httpsServer.address().port + '/')
      res.end()
    }, (server, url) => {
      const agent = new http.Agent()
      rock({ url, agent, rejectUnauthorized: false }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'secure')
        t.equal(res.statusCode, 200)
        agent.destroy(); server.close(); httpsServer.close()
      })
    })
  })
})

test('a value which is not an agent (false, true, agent options, a plain object...) uses the rock-req agent, without throwing', function (t) {
  const values = [false, true, undefined, null, 0, '', 'x', {}, { keepAlive: true }, Object.create(null), [], () => {}]
  t.plan(values.length * 2)
  startServer((req, res) => res.end('ok'), (server, url) => {
    let pending = values.length
    for (const agent of values) {
      rock({ url, agent }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'ok')
        if (--pending === 0) server.close()
      })
    }
  })
})
