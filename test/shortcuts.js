const rock = require('../')
const http = require('http')
const test = require('tape')

function startServer (ready) {
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ method: req.method, accept: req.headers.accept ?? null, contentType: req.headers['content-type'] ?? null, body }))
    })
  })
  server.listen(0, '127.0.0.1', () => ready(server, 'http://127.0.0.1:' + server.address().port))
}

test('get, post... keep the json option of the request (#7)', function (t) {
  t.plan(6)
  startServer((server, url) => {
    rock.get({ url, json: true }, (err, res, data) => {
      t.error(err)
      t.deepEqual(data, { method: 'GET', accept: 'application/json', contentType: null, body: '' })
      rock.post({ url, json: true }, { a: 1 }, (err, res, data) => {
        t.error(err)
        t.deepEqual(data, { method: 'POST', accept: 'application/json', contentType: 'application/json', body: '{"a":1}' })
        rock.get({ url }, (err, res, data) => {
          t.error(err)
          t.ok(Buffer.isBuffer(data), 'without json: a Buffer, as before')
          server.close()
        })
      })
    })
  })
})

test('get, post... keep the json option of an instance created with extend (#7)', function (t) {
  t.plan(4)
  const instance = rock.extend({ json: true })
  startServer((server, url) => {
    instance.get(url, (err, res, data) => {
      t.error(err)
      t.equal(data.accept, 'application/json')
      instance.get({ url, json: false }, (err, res, data) => {
        t.error(err)
        t.ok(Buffer.isBuffer(data), 'json: false on the request wins')
        server.close()
      })
    })
  })
})

test('getJSON, postJSON... always use json, even with json: false', function (t) {
  t.plan(4)
  startServer((server, url) => {
    rock.getJSON({ url, json: false }, (err, res, data) => {
      t.error(err)
      t.equal(data.accept, 'application/json')
      rock.postJSON(url, { b: 2 }, (err, res, data) => {
        t.error(err)
        t.equal(data.body, '{"b":2}')
        server.close()
      })
    })
  })
})

test('promises send a body given in the options or as the second argument, the second argument wins', function (t) {
  t.plan(4)
  startServer(async (server, url) => {
    const inOptions = await rock.promises.post({ url, body: 'in options' })
    t.equal(JSON.parse(inOptions.data).body, 'in options')
    const second = await rock.promises.post(url, 'second argument')
    t.equal(JSON.parse(second.data).body, 'second argument')
    const both = await rock.promises.post({ url, body: 'in options' }, 'second argument')
    t.equal(JSON.parse(both.data).body, 'second argument')
    const json = await rock.promises.postJSON({ url, body: { c: 3 } })
    t.equal(json.data.body, '{"c":3}')
    server.close()
  })
})

test('a rejected promise gets the response and the raw body when the callback gets them (invalid JSON)', function (t) {
  t.plan(11)
  const server = http.createServer((req, res) => { res.statusCode = 502; res.end('<html>Bad Gateway</html>') })
  server.listen(0, '127.0.0.1', async () => {
    const url = 'http://127.0.0.1:' + server.address().port
    rock.getJSON({ url, maxRetry: 0 }, (err, res, data) => {
      t.equal(err.name, 'SyntaxError')
      t.equal(res.statusCode, 502)
      t.equal(data.toString(), '<html>Bad Gateway</html>')
    })
    for (const call of [() => rock.promises.getJSON({ url, maxRetry: 0 }), () => rock.promises.get({ url, json: true, maxRetry: 0 })]) {
      try { await call(); t.fail() } catch (err) {
        t.equal(err.name, 'SyntaxError')
        t.equal(err.response.statusCode, 502)
        t.equal(err.data.toString(), '<html>Bad Gateway</html>')
      }
    }
    server.close()
    rock.promises.get({ url: 'http://127.0.0.1:1/', maxRetry: 0 }).catch((err) => {
      t.equal(err.code, 'ECONNREFUSED')
      t.equal('response' in err, false, 'no response: nothing added, like the callback')
    })
  })
})

test('a callback request with a body in the options still sends it', function (t) {
  t.plan(2)
  startServer((server, url) => {
    rock({ url, method: 'POST', body: 'in options' }, (err, res, data) => {
      t.error(err)
      t.equal(JSON.parse(data).body, 'in options')
      server.close()
    })
  })
})
