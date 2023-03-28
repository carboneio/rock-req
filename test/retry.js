const get = require('../')
const concat = get.simpleConcat
const http = require('http')
const net = require('net')
const selfSignedHttps = require('self-signed-https')
const test = require('tape')

test('should retry if there is socket errors', function (t) {
  t.plan(5 * 8)
  testRetryOnError(t, 'ECONNRESET')
  testRetryOnError(t, 'ETIMEDOUT')
  testRetryOnError(t, 'EADDRINUSE')
  testRetryOnError(t, 'ECONNREFUSED')
  testRetryOnError(t, 'EPIPE')
  testRetryOnError(t, 'ENOTFOUND')
  testRetryOnError(t, 'ENETUNREACH')
  testRetryOnError(t, 'EAI_AGAIN')
})

test('should retry if there are some HTTP code errors', function (t) {
  t.plan(5 * 10 /* 9 + 1 success */ + 9 /* second try which is a success */ )
  testRetryOnHttpCode(t, 408, 1)
  testRetryOnHttpCode(t, 429, 1)
  testRetryOnHttpCode(t, 500, 1)
  testRetryOnHttpCode(t, 502, 1)
  testRetryOnHttpCode(t, 503, 1)
  testRetryOnHttpCode(t, 504, 1)
  testRetryOnHttpCode(t, 521, 1)
  testRetryOnHttpCode(t, 522, 1)
  testRetryOnHttpCode(t, 524, 1)
  // should be ok
  testRetryOnHttpCode(t, 200, 0)
})

test('should retry "maxRetry" max on HTTP code error', function (t) {
  t.plan(9)
  var nbTry = 0;
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 503
    nbTry++;
    res.end('response')
  })
  server.listen(0, function () {
    const port = server.address().port
    get({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 5
    }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 503)
      concat(res, function (err, data) {
        t.error(err)
        t.equal(data.toString(), 'response')
        server.close()
      })
    })
  })
})

test('should retry even if there is an internal timeout', function (t) {
  t.plan(6)
  var nbRequestTimeout = 1;

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      return res.end('response')
    }
    nbRequestTimeout--;
    setTimeout(function () {
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 2000)
  })

  server.listen(0, function () {
    const port = server.address().port
    get({
      url: 'http://localhost:' + port + '/path',
      timeout: 1000
    }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 200)
      concat(res, function (err, data) {
        t.error(err)
        t.equal(data.toString(), 'response')
        server.close()
      })
    })
  })
})


function testRetryOnError(t, errorCode) {
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    setTimeout(function () {
      res.statusCode = 200
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 1000)
  })
  server.listen(0, function () {
    const port = server.address().port
    const request = get({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 2
    }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 200)
      concat(res, function (err, data) {
        t.error(err)
        t.equal(data.toString(), 'response')
        server.close()
      })
    })
    request.once('socket', (socket) => {
      var e = new Error(errorCode);
      e.code = errorCode;
      socket.destroy(e);
    });
  })
}

function testRetryOnHttpCode(t, httpCode, nbError) {
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = httpCode
    if (nbError === 0) {
      res.statusCode = 200
    }
    nbError--;
    res.end('response')
  })
  server.listen(0, function () {
    const port = server.address().port
    get({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 2
    }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 200)
      concat(res, function (err, data) {
        t.error(err)
        t.equal(data.toString(), 'response')
        server.close()
      })
    })
  })
}