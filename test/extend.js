const rock = require('../')
const http = require('http')
const str = require('string-to-stream')
const test = require('tape')
const zlib = require('zlib')
const selfSignedHttps = require('self-signed-https')

test('create new instance, merge with request header, should lower case headers', function (t) {
  t.plan(14)
  const server = http.createServer(function (req, res) {
    res.statusCode = 200
    if (req.url === '/origin') {
      t.equal(req.url, '/origin')
      t.equal(req.headers['x-test'], 'yeah')
      t.equal(req.headers['second-header'], undefined)
      t.equal(req.headers['custom-header'], 'custom-value')
      res.end('origin')
    }
    else if (req.url === '/instance') {
      t.equal(req.url, '/instance')
      t.equal(req.headers['x-test'], undefined)
      t.equal(req.headers['second-header'], '12')
      t.equal(req.headers['custom-header'], 'custom-value')
      res.end('instance')
    }
  })
  // modify current config
  rock.defaults.headers['x-test'] = 'yeah'
  // create new instance
  const newInstance = rock.extend({
    headers : {
      'Second-Header' : '12' // and should lower case 
    }
  })
  server.listen(0, function () {
    const port = server.address().port
    rock.concat({
      url: 'http://localhost:' + port + '/origin',
      headers: {
        'custom-header': 'custom-value'
      }
    }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'origin')
      newInstance.concat({
        url: 'http://localhost:' + port + '/instance',
        headers: {
          'custom-Header': 'custom-value'
        }
      }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'instance')
        server.close()
        t.deepEqual(newInstance.defaults.headers, { 'second-header': '12', 'accept-encoding': 'gzip, deflate, br' })
        t.deepEqual(rock.defaults.headers, { 'accept-encoding': 'gzip, deflate, br', 'x-test': 'yeah' })
        // reset
        delete rock.defaults.headers['x-test'];
      })
    })
  })
})


test('beforeRequest handler, combined with retries', function (t) {
  t.plan(10 + 4*3 + 1 )

  const server = http.createServer(function (req, res) {
    if (req.url === '/first-rewrite2') {
      t.equal(req.url, '/first-rewrite2')
      t.equal(req.headers['second-header'], undefined)
      res.statusCode = 503
      res.end('first-rewrite2')
    }
    else if (req.url === '/first-rewrite1') {
      t.equal(req.url, '/first-rewrite1')
      t.equal(req.headers['second-header'], undefined)
      res.statusCode = 200
      res.end('first-rewrite1')
    }
    else if (req.url === '/second-rewrite2') {
      t.equal(req.url, '/second-rewrite2')
      t.equal(req.headers['second-header'], 'hello')
      res.statusCode = 200
      res.end('second-rewrite2')
    }
  })

  // create new instance
  const newInstance = rock.extend({
    maxRetry : 2,
    beforeRequest: (parsedOpts) => {
      const { hostname, port, protocol, path } = parsedOpts
      t.equal(parsedOpts.maxRedirects, 10)
      t.equal(parsedOpts.maxRetry, 2)
      t.equal(parsedOpts.hostname, 'localhost')
      t.equal(parsedOpts.protocol, 'http:')
      if (parsedOpts.path === '/first' && parsedOpts.maxRetry === parsedOpts.remainingRetry){
        parsedOpts.path = '/first-rewrite' + parsedOpts.remainingRetry
      }
      if (parsedOpts.remainingRetry === (parsedOpts.maxRetry - 1)){
        t.equal(parsedOpts.prevStatusCode, 503)
        parsedOpts.path = '/first-rewrite' + parsedOpts.remainingRetry
      }
      if (parsedOpts.path === '/second') {
        parsedOpts.path = '/second-rewrite' + parsedOpts.remainingRetry
        parsedOpts.headers['second-header'] = 'hello'
      }
      return parsedOpts
    },
  })

  server.listen(0, function () {
    const port = server.address().port
    // test with opts as a string
    newInstance.concat('http://localhost:' + port + '/first', function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'first-rewrite1')
      // test with opts as a object
      newInstance.concat({
        url: 'http://localhost:' + port + '/second',
        headers: {
          'second-header': 'second-header-overwritten'
        }
      }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'second-rewrite2')
        server.close()
      })
    })
  })
})


test('beforeRequest handler, combined with redirect with absolute URL', function (t) {
  t.plan(5 + 2*4)

  let httpsPort = null
  let httpPort = null

  const httpServer = http.createServer(function (req, res) {
    t.equal(req.url, '/path1')
    res.statusCode = 301
    res.setHeader('Location', 'https://localhost:' + httpsPort + '/path2')
    res.end()
  })

  const httpsServer = selfSignedHttps(function (req, res) {
    t.equal(req.url, '/path2')
    res.statusCode = 200
    res.end('response')
  })

  // create new instance
  const newInstance = rock.extend({
    maxRedirects : 5,
    beforeRequest: (parsedOpts) => {
      t.equal(parsedOpts.maxRedirects, 5)
      if (parsedOpts.remainingRedirects === 5) {
        t.equal(parsedOpts.hostname, 'localhost')
        t.equal(parsedOpts.path, '/before')
        t.equal(parsedOpts.protocol, 'http:')
        parsedOpts.path = '/path1'
      }
      if (parsedOpts.remainingRedirects === 4) {
        t.equal(parsedOpts.hostname, 'localhost')
        t.equal(parsedOpts.path, '/path2')
        t.equal(parsedOpts.protocol, 'https:')
      }
      return parsedOpts
    },
  })

  httpServer.listen(0, function () {
    httpPort = httpServer.address().port
    httpsServer.listen(0, function () {
      httpsPort = httpsServer.address().port
      newInstance({
        url: 'http://localhost:' + httpPort + '/before',
        rejectUnauthorized: false
      }, function (err, res, data) {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(data.toString(), 'response')
        httpsServer.close()
        httpServer.close()
      })
    })
  })
})


test('beforeRequest handler, combined with redirect with relative URL', function (t) {
  t.plan(5 + 4 + 3)

  let httpPort = null

  const httpServer = http.createServer(function (req, res) {
    if (req.url === '/path1') {
      t.equal(req.url, '/path1')
      res.setHeader('Location', '/path2')
      res.statusCode = 301
      return res.end()
    }
    t.equal(req.url, '/path2')
    res.statusCode = 200
    res.end('response')
  })

  // create new instance
  const newInstance = rock.extend({
    maxRedirects : 5,
    beforeRequest: (parsedOpts) => {
      t.equal(parsedOpts.maxRedirects, 5)
      if (parsedOpts.remainingRedirects === 5) {
        t.equal(parsedOpts.hostname, 'localhost')
        t.equal(parsedOpts.path, '/before')
        t.equal(parsedOpts.protocol, 'http:')
        parsedOpts.path = '/path1'
      }
      if (parsedOpts.remainingRedirects === 4) {
        t.equal(parsedOpts.hostname, 'localhost')
        t.equal(parsedOpts.path, '/path2')
      }
      return parsedOpts
    },
  })

  httpServer.listen(0, function () {
    httpPort = httpServer.address().port
    newInstance({
      url: 'http://localhost:' + httpPort + '/before',
      rejectUnauthorized: false
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      httpServer.close()
    })
  })
})