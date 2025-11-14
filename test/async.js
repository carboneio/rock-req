const rock = require('../')
const http = require('http')
const selfSignedHttps = require('./cert/self-signed-https')
const test = require('tape')

test('simple rock.promises.getJSON', async function (t) {
  t.plan(5)

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    t.equal(req.headers.accept, 'application/json')
    res.statusCode = 200
    res.end('{"message":"response"}')
  })

  await new Promise((resolve) => {
    server.listen(0, async function () {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port + '/path',
        json: true
      }
      const { response, data } = await rock.promises.getJSON(opts)
      t.error(response.error)
      t.equal(response.statusCode, 200)
      t.equal(JSON.stringify(data), '{"message":"response"}')
      server.close()
      resolve()
    })
  })
})


test('post rock.promises.postJSON', async function (t) {
  t.plan(4)

  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'POST')
    t.equal(req.headers['content-type'], 'application/json')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve) => {
    server.listen(0, async function () {
      const port = server.address().port
      const body = {
        message: 'this is the body'
      };
      const { response, data } = await rock.promises.postJSON('http://localhost:' + port, body)
      t.equal(response.statusCode, 200)
      t.equal(data.message, 'this is the body')
      server.close()
      resolve()
    })
  })
})