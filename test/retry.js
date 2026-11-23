const rock = require('../')
const http = require('http')
const test = require('tape')
const { Writable, Readable, PassThrough, finished } = require('stream')

test('should retry if there is socket errors', function (t) {
  t.plan(4 * 8)
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
  t.plan(4 * 9 /* 8 + 1 success */ + 8 /* second try which is a success */)
  testRetryOnHttpCode(t, 408, 1)
  testRetryOnHttpCode(t, 429, 1)
  testRetryOnHttpCode(t, 502, 1)
  testRetryOnHttpCode(t, 503, 1)
  testRetryOnHttpCode(t, 504, 1)
  testRetryOnHttpCode(t, 521, 1)
  testRetryOnHttpCode(t, 522, 1)
  testRetryOnHttpCode(t, 524, 1)
  // should be ok
  testRetryOnHttpCode(t, 200, 0)
})

test('should not retry if maxRetry === 0', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 502
    res.end('response')
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: 0,
      retryOnCode: [502]
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 502)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should not retry if maxRetry < 0', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 502
    res.end('response')
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: -1,
      retryOnCode: [502]
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 502)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should retry "maxRetry" max on HTTP code error', function (t) {
  t.plan(10)
  let nbTry = 0
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 503
    nbTry++
    res.end('response')
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: 5
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 503)
      t.equal(nbTry, 6)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should use read default.retryOnError to check if rock need to retry or not', function (t) {
  t.plan(10)
  let nbTry = 0
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 404
    nbTry++
    res.end('response')
  })
  const myInstance = rock.extend({ retryOnCode: [404] })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    myInstance({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: 5
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(nbTry, 5 + 1)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should retry even if there is a timeout', function (t) {
  t.plan(5)
  let nbRequestTimeout = 1

  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      return res.end('response')
    }
    nbRequestTimeout--
    setTimeout(function () {
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 2000)
  })

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      timeout: 1000,
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should retry with POST even if there is a timeout. SHould keep headers on each retry', function (t) {
  t.plan(9)
  let nbRequestTimeout = 1
  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'POST')
    t.equal(req.headers['x-test'], '145')
    t.equal(req.headers['accept-encoding'], 'gzip, deflate, br')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      req.pipe(res)
      return
    }
    nbRequestTimeout--
    setTimeout(function () {
      // response should not be sent
      res.end('response')
    }, 1000)
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      body: 'body message',
      method: 'POST',
      headers: { 'X-TEST': '145' },
      timeout: 1000,
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'body message')
      server.close()
    })
  })
})

test('should retry with postJSON function and accept to set a default global timeout', function (t) {
  t.plan(5)
  let nbRequestTimeout = 1
  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'POST')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      req.pipe(res)
      return
    }
    nbRequestTimeout--
    setTimeout(function () {
      // response should not be sent
      res.end('response')
    }, 1000)
  })
  const newInstance = rock.extend({ maxRetry: 2, timeout: 500 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    newInstance.post('http://127.0.0.1:' + port + '/path', 'body message', function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'body message')
      server.close()
    })
  })
})

test('should retry if the error is coming from the server after receiving the first response', function (t) {
  t.plan(5)
  let nbTry = 0
  const server = http.createServer(function (req, res) {
    nbTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    setTimeout(() => {
      if (nbTry === 1) {
        t.equal(nbTry, 1)
        res.socket.destroy(new Error('ECONNRESET'))
      } else {
        res.end('6789')
      }
    }, 1000)
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    newInstance.concat('http://127.0.0.1:' + port, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should retry if the socket is closed immediately on server side without delay', function (t) {
  t.plan(5)
  let nbTry = 0
  const server = http.createServer(function (req, res) {
    nbTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    if (nbTry === 1) {
      t.equal(nbTry, 1)
      res.socket.destroy()
    } else {
      res.end('6789')
    }
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    newInstance.concat('http://127.0.0.1:' + port, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new INPUT stream on retry (error on server side)', function (t) {
  t.plan(13)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  let nbBytesReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      nbBytesReceived += chunk.length
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString().slice(0, 5), 'abcde') // Node >= 24.22 sends same-tick writes in one HTTP chunk (nodejs/node#64987)
        res.socket.destroy(new Error('ECONNRESET'))
      }
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(() => {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            this.push(this.data[this.it++])
          }
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      method: 'POST'
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(nbBytesReceived, 20) // 10 bytes per try, whatever the HTTP chunking
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new INPUT stream on retry (error on input stream)', function (t) {
  t.plan(17)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 2) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 3) {
        t.equal(chunk.toString(), 'fghij')
      }
    })
    req.on('error', (e) => {
      t.ok(e instanceof Error)
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(function () {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            if (this.it === 1 && nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET')
              _error.code = 'ECONNRESET'
              myReadStream.destroy(_error)
            }
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        })
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbDataChunkReceived, 3)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should accept finish/cleanup on INPUT stream even if there is a timeout and the input stream is already closed', function (t) {
  t.plan(8)

  let nbServerTry = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    if (nbServerTry === 1) {
      setTimeout(() => {
        res.end('12345')
      }, 2000)
    } else {
      res.end('realEnd')
    }
  })
  server.setTimeout(3000) // NodeJS < 19 does not close keep-alive socket automatically
  const newInstance = rock.extend({ maxRetry: 2 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    let nbClientFinishedInputStream = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = Readable.from(['yeah'], { objectMode: false })
        const cleanup = finished(myReadStream, (err) => {
          nbClientFinishedInputStream++
          t.error(err)
          cleanup()
        })
        return myReadStream
      },
      method: 'POST',
      timeout: 500,
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientFinishedInputStream, 2)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'realEnd')
      server.close()
    })
  })
})

test('should return an error and not retry if the INPUT stream is destroyed since the beginning', function (t) {
  t.plan(5)

  let nbServerTry = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.end('realEnd')
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = Readable.from(['yeah'], { objectMode: false })
        myReadStream.destroy(new Error('Not readable'))
        return myReadStream
      },
      method: 'POST',
      timeout: 500,
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Not readable')
      t.equal(nbServerTry, 0)
      t.equal(nbClientInputStreamCreated, 1)
      t.equal(res, undefined)
      server.close()
    })
  })
})

test('should destroy and restart a new OUTPUT stream on retry (error on input stream)', function (t) {
  t.plan(20)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 2) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 3) {
        t.equal(chunk.toString(), 'fghij')
      }
    })
    req.on('error', (e) => {
      t.ok(e instanceof Error)
      t.equal(e.code, 'ECONNRESET')
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(function () {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  const outputStreams = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    let nbClientOutputStreamCreated = 0
    let outputChunks = []
    const opts = {
      url: 'http://127.0.0.1:' + port,
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        outputStreams.push(myWriteStream)
        return myWriteStream
      },
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            if (this.it === 1 && nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET')
              _error.code = 'ECONNRESET'
              myReadStream.destroy(_error)
            }
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        })
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 1)
      t.equal(nbDataChunkReceived, 3)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(outputStreams[0].destroyed, true)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join('').toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new OUTPUT stream on retry (error on input stream, after a certain amount of time, output stream was started)', function (t) {
  t.plan(22)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  const dataToSend = Array(50).fill('abcde')
  dataToSend.push(null)
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 26) {
        t.equal(chunk.toString(), 'abcde')
      }
    })
    req.on('error', (e) => {
      t.ok(e instanceof Error)
      t.equal(e.code, 'ECONNRESET')
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), dataToSend.slice(0, -1).join(''))
        t.equal(nbServerTry, 2)
        setTimeout(function () {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  const outputStreams = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    let nbClientOutputStreamCreated = 0
    let outputChunks = []
    const opts = {
      url: 'http://127.0.0.1:' + port,
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        myWriteStream.on('error', (e) => {
          t.ok(e instanceof Error)
          t.equal(e.code, 'ECONNRESET')
        })
        outputStreams.push(myWriteStream)
        return myWriteStream
      },
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = dataToSend
            this.it = 0
            cb()
          },
          read (size) {
            if (this.it === 25 && nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET')
              _error.code = 'ECONNRESET'
              myReadStream.destroy(_error)
            }
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 2)
          }
        })
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 2)
      t.equal(nbDataChunkReceived, 50 + 25)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(outputStreams[0].destroyed, true)
      t.equal(outputStreams[1].destroyed, true)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join('').toString(), '123456789')
      server.close()
    })
  })
})

test('should return an error and not retry if the OUTPUT stream is destroyed since the beginning', function (t) {
  t.plan(5)

  let nbServerTry = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.end('realEnd')
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientOutpoutStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: 'yes',
      output: (opts, res) => {
        nbClientOutpoutStreamCreated++
        const outputChunks = []
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        myWriteStream.destroy(new Error('Not writable'))
        return myWriteStream
      },
      method: 'POST',
      timeout: 500,
      maxRetry: 2
    }
    newInstance(opts, function (err, res) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Not writable')
      t.equal(nbServerTry, 1)
      t.equal(nbClientOutpoutStreamCreated, 1)
      t.equal(res, undefined)
      server.close()
    })
  })
})

test('should destroy and restart a new OUTPUT stream on retry (error on output stream)', function (t) {
  t.plan(19)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 2) {
        t.equal(chunk.toString(), 'abcde')
      }
      if (nbServerTry === 2 && nbDataChunkReceived === 3) {
        t.equal(chunk.toString(), 'fghij')
      }
    })
    req.on('error', (e) => {
      t.ok(e instanceof Error)
      t.equal(e.code, 'ECONNRESET')
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(function () {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    let nbClientOutputStreamCreated = 0
    let outputChunks = []
    const opts = {
      url: 'http://127.0.0.1:' + port,
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            if (nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET')
              _error.code = 'ECONNRESET'
              myWriteStream.destroy(_error)
            }
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        return myWriteStream
      },
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        })
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 2)
      t.equal(nbDataChunkReceived, 3)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join('').toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new OUTPUT stream on retry (error on server side)', function (t) {
  t.plan(16)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  let nbBytesReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      nbBytesReceived += chunk.length
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString().slice(0, 5), 'abcde') // Node >= 24.22 sends same-tick writes in one HTTP chunk (nodejs/node#64987)
        res.socket.destroy(new Error('ECONNRESET'))
      }
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(() => {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  const outputStreams = []
  let nbClientOutputStreamCreated = 0
  let outputChunks = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            this.push(this.data[this.it++])
          }
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        outputStreams.push(myWriteStream)
        return myWriteStream
      },
      method: 'POST'
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 2)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(outputStreams[0].destroyed, true)
      t.equal(outputStreams[1].destroyed, true)
      t.equal(nbBytesReceived, 20) // 10 bytes per try, whatever the HTTP chunking
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join(''), '123456789')
      server.close()
    })
  })
})

test('should accept using finished/cleanup function of NodeJS on OUTPUT stream on retry (error on server side)', function (t) {
  t.plan(18)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  let nbBytesReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      nbBytesReceived += chunk.length
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString().slice(0, 5), 'abcde') // Node >= 24.22 sends same-tick writes in one HTTP chunk (nodejs/node#64987)
        res.socket.destroy(new Error('ECONNRESET'))
      }
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(() => {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  let nbClientOutputStreamCreated = 0
  let nbClientOutputFinishedStream = 0
  let outputChunks = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            this.push(this.data[this.it++])
          }
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        const cleanup = finished(myWriteStream, (err) => {
          nbClientOutputFinishedStream++
          if (nbClientOutputFinishedStream === 1) {
            t.ok(err instanceof Error)
            t.equal(err.code, 'ECONNRESET')
          } else {
            t.error(err)
          }
          cleanup()
        })
        return myWriteStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 2)
      t.equal(nbClientOutputFinishedStream, 2)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(nbBytesReceived, 20) // 10 bytes per try, whatever the HTTP chunking
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join(''), '123456789')
      server.close()
    })
  })
})

test('should accept to use stream.on(error) on Writable stream (error on server side)', function (t) {
  t.plan(17)

  let nbServerTry = 0
  let nbDataChunkReceived = 0
  let nbBytesReceived = 0
  const server = http.createServer(function (req, res) {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    t.equal(req.url, '/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      nbBytesReceived += chunk.length
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString().slice(0, 5), 'abcde') // Node >= 24.22 sends same-tick writes in one HTTP chunk (nodejs/node#64987)
        res.socket.destroy(new Error('ECONNRESET'))
      }
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        t.equal(chunks.join(''), 'abcdefghij')
        t.equal(nbServerTry, 2)
        setTimeout(() => {
          res.end('6789')
        }, 200)
      }
    })
  })
  const newInstance = rock.extend({ maxRetry: 2 })
  const inputStreams = []
  let nbClientOutputStreamCreated = 0
  let nbClientOutputErrorStream = 0
  let outputChunks = []
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0
    const opts = {
      url: 'http://127.0.0.1:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++
        const myReadStream = new Readable({
          construct (cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read (size) {
            this.push(this.data[this.it++])
          }
        })
        inputStreams.push(myReadStream)
        return myReadStream
      },
      output: (opts, res) => {
        outputChunks = []
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString())
            wcb()
          }
        })
        myWriteStream.once('error', (err) => {
          nbClientOutputErrorStream++
          t.ok(err instanceof Error)
          t.equal(err.code, 'ECONNRESET')
        })
        return myWriteStream
      },
      method: 'POST',
      maxRetry: 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 2)
      t.equal(nbClientOutputErrorStream, 1)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(nbBytesReceived, 20) // 10 bytes per try, whatever the HTTP chunking
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join(''), '123456789')
      server.close()
    })
  })
})

function testRetryOnError (t, errorCode) {
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    setTimeout(function () {
      res.statusCode = 200
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 1000)
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    const request = rock({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
    request.once('socket', (socket) => {
      const e = new Error(errorCode)
      e.code = errorCode
      socket.destroy(e)
    })
  })
}

function testRetryOnHttpCode (t, httpCode, nbError) {
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = httpCode
    if (nbError === 0) {
      res.statusCode = 200
    }
    nbError--
    res.end('response')
  })
  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port
    rock({
      url: 'http://127.0.0.1:' + port + '/path',
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
}

// retry policy

function serve (handler, ready) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1', () => ready('http://127.0.0.1:' + server.address().port, server))
}
function hangUp (req, res) { req.socket.destroy() } // the client gets ECONNRESET (socket hang up)

test('maxRetry is the real number of retries on network errors (no off-by-one)', function (t) {
  t.plan(6)
  let nb = 0
  serve((req, res) => { nb++; hangUp(req, res) }, (url, server) => {
    rock({ url, maxRetry: 1, retryDelay: 1 }, function (err) {
      t.equal(err.code, 'ECONNRESET')
      t.equal(nb, 2, 'maxRetry 1: 1 request + 1 retry')
      nb = 0
      rock({ url, maxRetry: 2, retryDelay: 1 }, function (err) {
        t.equal(err.code, 'ECONNRESET')
        t.equal(nb, 3, 'maxRetry 2: 1 request + 2 retries')
        nb = 0
        rock({ url, maxRetry: 0 }, function (err) {
          t.equal(err.code, 'ECONNRESET')
          t.equal(nb, 1, 'maxRetry 0: no retry')
          server.close()
        })
      })
    })
  })
})

test('beforeRequest sees remainingRetry decremented on each retry (status and network error paths)', function (t) {
  t.plan(8)
  let nb = 0
  const seen = []
  const myRock = rock.extend({
    maxRetry: 2,
    retryDelay: 1,
    beforeRequest: (opts) => { seen.push([opts.remainingRetry < opts.maxRetry, opts.remainingRetry, opts.prevError?.code, opts.prevStatusCode]); return opts }
  })
  serve((req, res) => {
    nb++
    if (req.url === '/status') { res.statusCode = nb < 3 ? 503 : 200; return res.end('ok') }
    if (nb < 3) return hangUp(req, res)
    res.end('ok')
  }, (url, server) => {
    myRock(url + '/status', function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'ok')
      t.deepEqual(seen, [[false, 2, undefined, undefined], [true, 1, undefined, 503], [true, 0, undefined, 503]])
      nb = 0; seen.length = 0
      myRock(url + '/error', function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'ok')
        t.deepEqual(seen.map(s => s.slice(0, 3)), [[false, 2, undefined], [true, 1, 'ECONNRESET'], [true, 0, 'ECONNRESET']])
        t.equal(nb, 3)
        t.equal(seen.length, 3)
        server.close()
      })
    })
  })
})

test('POST and PATCH are retried by default on retryOnCode, ECONNRESET and timeout (like 5.x)', function (t) {
  t.plan(7)
  let nb = 0
  serve((req, res) => {
    nb++
    if (req.url === '/503') { res.statusCode = 503; return res.end('busy') }
    if (req.url === '/reset') return hangUp(req, res)
    setTimeout(() => res.end('late'), 300)
  }, (url, server) => {
    rock({ url: url + '/503', method: 'POST', body: 'a', maxRetry: 2, retryDelay: 1 }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 503)
      t.equal(nb, 3)
      nb = 0
      rock.post({ url: url + '/reset', retryDelay: 1 }, 'a', function (err) {
        t.equal(err.code, 'ECONNRESET')
        t.equal(nb, 2, 'default maxRetry 1: 1 request + 1 retry')
        nb = 0
        rock.patch({ url: url + '/slow', maxRetry: 1, retryDelay: 1, timeout: 50 }, 'a', function (err) {
          t.equal(err.code, 'ETIMEDOUT')
          t.equal(nb, 2)
          server.close()
        })
      })
    })
  })
})

test('exponential backoff with jitter, capped by retryMaxDelay', function (t) {
  t.plan(6)
  const hits = []
  serve((req, res) => { hits.push(Date.now()); res.statusCode = 503; res.end() }, (url, server) => {
    rock({ url, maxRetry: 4, retryDelay: 20, retryMaxDelay: 70 }, function (err, res) {
      t.error(err)
      t.equal(hits.length, 5)
      const gaps = hits.slice(1).map((h, i) => h - hits[i])
      // delays: [20,40) then [40,70] then 70 (capped) then 70 (capped)
      t.ok(gaps[0] >= 19 && gaps[0] < 400, 'first retry ' + gaps[0])
      t.ok(gaps[1] >= 39 && gaps[1] < 400, 'second retry ' + gaps[1])
      t.ok(gaps[2] >= 69 && gaps[3] >= 69 && gaps[2] < 400 && gaps[3] < 400, 'capped ' + gaps.slice(2))
      const start = Date.now()
      rock({ url, maxRetry: 2, retryDelay: 10000, retryMaxDelay: 30 }, function () {
        t.ok(Date.now() - start < 1000, 'retryMaxDelay caps a large retryDelay')
        server.close()
      })
    })
  })
})

test('Retry-After (seconds or HTTP-date) on 429/503 is respected, ignored if invalid, no retry if > retryMaxDelay', function (t) {
  t.plan(14)
  let hits = []
  let retryAfter = ''
  let status = 503
  serve((req, res) => {
    hits.push(Date.now())
    res.statusCode = hits.length === 1 ? status : 200
    if (hits.length === 1) res.setHeader('retry-after', retryAfter)
    res.end('body' + hits.length)
  }, (url, server) => {
    retryAfter = '1'
    rock({ url, maxRetry: 1, retryDelay: 1 }, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), 'body2')
      t.ok(hits[1] - hits[0] >= 990, 'waits Retry-After seconds ' + (hits[1] - hits[0]))
      hits = []; retryAfter = new Date(Date.now() + 1500).toUTCString(); status = 429
      rock({ url, maxRetry: 1, retryDelay: 1 }, function (err, res, data) {
        t.error(err)
        t.equal(data.toString(), 'body2')
        t.ok(hits[1] - hits[0] >= 400, 'waits Retry-After HTTP-date ' + (hits[1] - hits[0]))
        hits = []; retryAfter = '5'; status = 503
        rock({ url, maxRetry: 1, retryDelay: 1, retryMaxDelay: 2000 }, function (err, res, data) {
          t.error(err)
          t.equal(res.statusCode, 503, 'Retry-After > retryMaxDelay: response returned as is')
          t.equal(data.toString(), 'body1')
          hits = []; retryAfter = 'soon'
          rock({ url, maxRetry: 1, retryDelay: 1 }, function (err, res, data) {
            t.error(err)
            t.equal(data.toString(), 'body2', 'invalid Retry-After ignored')
            t.ok(hits[1] - hits[0] < 500, 'no wait ' + (hits[1] - hits[0]))
            hits = []; retryAfter = '5'; status = 502
            rock({ url, maxRetry: 1, retryDelay: 1 }, function (err, res, data) {
              t.error(err)
              t.equal(data.toString(), 'body2', 'Retry-After only read on 429/503')
              server.close()
            })
          })
        })
      })
    })
  })
})

test('a request destroyed by the user (abort) is not retried, before or during the response', function (t) {
  t.plan(10)
  let nb = 0
  serve((req, res) => {
    nb++
    if (req.url === '/body') { res.write('partial'); return }
    setTimeout(() => res.end('late'), 300)
  }, (url, server) => {
    let nbOutput = 0
    let nbCb = 0
    const output = () => { nbOutput++; return new Writable({ write (c, e, cb) { cb() } }) }
    const req = rock({ url, maxRetry: 2, retryDelay: 1, output }, function (err, res) {
      nbCb++
      t.equal(err?.code, 'ECONNRESET')
      t.equal(res, undefined)
      t.equal(nb, 1, 'no second request')
      t.equal(nbOutput, 0)
      nb = 0
      const req2 = rock({ url: url + '/body', maxRetry: 2, retryDelay: 1, output: (o, res) => { setTimeout(() => req2.abort(), 20); return output() } }, function (err) {
        nbCb++
        t.ok(err, 'aborted during the response')
        t.equal(nb, 1, 'no second request')
        t.equal(nbOutput, 1, 'output function called once')
        setTimeout(() => {
          t.equal(nbCb, 2, 'callback called once per request')
          t.equal(nb, 1)
          t.equal(req.destroyed && req2.destroyed, true)
          server.close()
          server.closeAllConnections?.()
        }, 100)
      })
    })
    setTimeout(() => req.destroy(), 50)
  })
})

test('a response cut by the server (FIN or RST mid-body) is still retried', function (t) {
  t.plan(4)
  let nb = 0
  serve((req, res) => {
    nb++
    if (nb === 1) { res.write('partial'); return setTimeout(() => req.socket.destroy(), 20) }
    if (nb === 2) { res.write('partial'); return setTimeout(() => req.socket.resetAndDestroy ? req.socket.resetAndDestroy() : req.socket.destroy(), 20) }
    res.end('ok')
  }, (url, server) => {
    rock({ url, maxRetry: 2, retryDelay: 1 }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'ok')
      t.equal(nb, 3)
      server.close()
    })
  })
})

// output returning the same destination, emitClose: false, 101 upgrade (5.3.2)

test('a retry whose output() returns the same destination (destroyed by the failed attempt) calls back once with the error, mid-body or before the first byte', function (t) {
  t.plan(2 * 6)
  for (const writeFirst of [true, false]) {
    let nb = 0
    serve((req, res) => {
      nb++
      res.writeHead(200, { 'content-length': 100 })
      if (writeFirst) res.write('PARTIAL')
      else res.flushHeaders()
      setTimeout(() => res.socket.destroy(), 20)
    }, (url, server) => {
      const destination = new PassThrough()
      destination.on('error', () => {})
      destination.resume()
      let outputs = 0
      let calls = 0
      rock({ url, maxRetry: 2, retryDelay: 1, output: () => { outputs++; return destination } }, function (err, res) {
        calls++
        t.ok(err instanceof Error)
        t.equal(res, undefined)
        t.equal(outputs, 2, 'output() called again by the retry, its destroyed stream ends the request')
        t.equal(nb, 2)
        t.equal(destination.destroyed, true)
        setTimeout(() => {
          t.equal(calls, 1)
          server.close()
        }, 100)
      })
    })
  }
})

test('a retry with a new output stream recovers from a reset before the first byte', function (t) {
  t.plan(4)
  let nb = 0
  serve((req, res) => {
    nb++
    if (nb === 1) {
      res.writeHead(200, { 'content-length': 100 })
      res.flushHeaders()
      return setTimeout(() => res.socket.destroy(), 20)
    }
    res.end('OK')
  }, (url, server) => {
    const outputs = []
    rock({
      url,
      retryDelay: 1,
      output: () => {
        const chunks = []
        outputs.push(chunks)
        const w = new Writable({ write (chunk, enc, wcb) { chunks.push(chunk.toString()); wcb() } })
        w.on('error', () => {})
        return w
      }
    }, function (err, res) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(outputs.length, 2)
      t.equal(outputs[1].join(''), 'OK')
      server.close()
    })
  })
})

test('an output() returning a stream already destroyed without error ends the request with an error', function (t) {
  t.plan(3)
  serve((req, res) => res.end('DATA'), (url, server) => {
    const w = new Writable({ write (chunk, enc, wcb) { wcb() } })
    w.destroy()
    rock({ url, output: () => w }, function (err, res) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'opts.output returned a destroyed stream')
      t.equal(res, undefined)
      server.close()
    })
  })
})

test('an output stream with emitClose: false calls back once, after finish', function (t) {
  t.plan(4)
  serve((req, res) => res.end('DATA'), (url, server) => {
    const chunks = []
    let calls = 0
    rock({ url, output: () => new Writable({ emitClose: false, write (chunk, enc, wcb) { chunks.push(chunk); wcb() } }) }, function (err, res) {
      calls++
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(Buffer.concat(chunks).toString(), 'DATA')
      setTimeout(() => {
        t.equal(calls, 1)
        server.close()
      }, 50)
    })
  })
})

test('a 101 upgrade answer to a normal request calls back once with an error, the socket kept open or closed by the server', function (t) {
  t.plan(2 * 4)
  for (const keepOpen of [true, false]) {
    let nb = 0
    serve((req) => {
      nb++
      req.socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: x\r\nConnection: Upgrade\r\n\r\n')
      if (keepOpen === false) req.socket.end()
    }, (url, server) => {
      let calls = 0
      rock({ url, timeout: 300 }, function (err) {
        calls++
        t.ok(err instanceof Error)
        t.equal(err.code, 'EUNEXPECTEDUPGRADE')
        t.equal(nb, 1, 'not retried')
        setTimeout(() => {
          t.equal(calls, 1)
          server.closeAllConnections?.()
          server.close()
        }, 100)
      })
    })
  }
})

test('a retry whose output() returns the same destination calls back once with the error, even when the retry succeeds', function (t) {
  t.plan(4)
  let nb = 0
  let outputs = 0
  serve((req, res) => {
    nb++
    if (nb === 1) {
      res.writeHead(200, { 'content-length': 100 })
      res.flushHeaders()
      return setTimeout(() => res.socket.destroy(), 20)
    }
    res.end('FULL')
  }, (url, server) => {
    const dest = new Writable({ write (chunk, enc, wcb) { wcb() } })
    dest.on('error', () => {})
    let calls = 0
    rock({ url, retryDelay: 1, output: () => { outputs++; return dest } }, function (err) {
      calls++
      t.ok(err instanceof Error, 'the error of the cut attempt')
      t.equal(outputs, 2)
      setTimeout(() => {
        t.equal(calls, 1, 'called back once, never waits for the close of the destroyed destination')
        t.equal(nb, 2)
        server.closeAllConnections?.()
        server.close()
      }, 100)
    })
  })
})

test('an output destroyed without error after end() and before finish calls back once, as before', function (t) {
  t.plan(2)
  serve((req, res) => res.end(Buffer.alloc(64 * 1024, 97)), (url, server) => {
    const dest = new Writable({ highWaterMark: 1 << 30, write (chunk, enc, wcb) { setTimeout(wcb, 100) } })
    let calls = 0
    rock({ url, output: () => dest }, function (err) {
      calls++
      t.error(err)
    })
    setTimeout(() => dest.destroy(), 50)
    setTimeout(() => {
      t.equal(calls, 1)
      server.closeAllConnections?.()
      server.close()
    }, 400)
  })
})

test('an upgrade handled by the caller (its own "upgrade" listener) keeps its socket, as before', function (t) {
  t.plan(3)
  const server = http.createServer()
  server.on('upgrade', (req, socket) => {
    socket.on('error', () => {}) // the client destroys the socket: ECONNRESET on the server side (Node 16)
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: x\r\nConnection: Upgrade\r\n\r\n')
    socket.write('hi')
  })
  server.listen(0, '127.0.0.1', () => {
    let calls = 0
    const req = rock({ url: 'http://127.0.0.1:' + server.address().port, headers: { Connection: 'Upgrade', Upgrade: 'x' } }, () => { calls++ })
    req.on('upgrade', (res, socket, head) => {
      t.equal(res.statusCode, 101)
      t.equal(socket.destroyed, false, 'the socket is given to the caller')
      socket.destroy()
      setTimeout(() => {
        t.equal(calls, 0, 'rock-req leaves the request to the caller')
        server.closeAllConnections?.()
        server.close()
      }, 50)
    })
  })
})

test('a CONNECT tunnel handled by the caller is neither retried nor called back, as before', function (t) {
  t.plan(3)
  let connects = 0
  const proxy = http.createServer()
  proxy.on('connect', (req, socket) => {
    connects++
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    socket.on('data', (d) => socket.write('echo:' + d))
    socket.on('error', () => {})
  })
  proxy.listen(0, '127.0.0.1', () => {
    let calls = 0
    const req = rock({ method: 'CONNECT', hostname: '127.0.0.1', port: proxy.address().port, path: 'example.com:443' }, () => { calls++ })
    req.on('connect', (res, socket) => {
      t.equal(res.statusCode, 200)
      socket.write('ping')
      socket.once('data', () => {
        socket.destroy()
        setTimeout(() => {
          t.equal(connects, 1, 'not retried')
          t.equal(calls, 0, 'the tunnel belongs to the caller')
          proxy.closeAllConnections?.()
          proxy.close()
        }, 100)
      })
    })
  })
})

test('a request aborted synchronously by the caller calls back once with an error, not retried', function (t) {
  t.plan(3)
  let nb = 0
  serve((req, res) => { nb++; res.end('x') }, (url, server) => {
    let calls = 0
    const req = rock({ url }, function (err) {
      calls++
      t.ok(err instanceof Error)
    })
    req.abort()
    setTimeout(() => {
      t.equal(calls, 1)
      t.ok(nb <= 1, 'not retried')
      server.closeAllConnections?.()
      server.close()
    }, 200)
  })
})

/** A server whose first answer is cut after the headers (ECONNRESET, retried), the next ones answer 'FULL' */
function serveCutOnce (ready) {
  let nb = 0
  serve((req, res) => {
    nb++
    if (nb === 1) {
      res.writeHead(200, { 'content-length': 100 })
      res.flushHeaders()
      return setTimeout(() => res.socket.destroy(), 20)
    }
    res.end('FULL')
  }, ready)
}

test('an output() returning, on a retry, a stream destroyed by the caller without error returns the error of the failed attempt', function (t) {
  t.plan(3)
  serveCutOnce((url, server) => {
    let calls = 0
    const output = () => {
      calls++
      const w = new Writable({ write (chunk, enc, wcb) { wcb() } })
      if (calls === 2) w.destroy() // destroyed by the caller, no error of its own
      return w
    }
    rock({ url, retryDelay: 1, output }, function (err) {
      t.equal(err?.code, 'ECONNRESET', 'the network error of the first attempt')
      t.equal(calls, 2)
      setTimeout(() => {
        t.pass('called back once')
        server.closeAllConnections?.()
        server.close()
      }, 50)
    })
  })
})

test('an output() returning, on a retry, a stream destroyed with its own error returns that error, not the network error', function (t) {
  t.plan(2)
  serveCutOnce((url, server) => {
    let calls = 0
    const output = () => {
      calls++
      const w = new Writable({ write (chunk, enc, wcb) { wcb() } })
      if (calls === 2) {
        w.on('error', () => {})
        w.destroy(new Error('disk full'))
      }
      return w
    }
    rock({ url, retryDelay: 1, output }, function (err) {
      t.equal(err?.message, 'disk full')
      t.equal(calls, 2)
      server.closeAllConnections?.()
      server.close()
    })
  })
})

test('an output() returning a destroyed object which is not a Node stream (no _writableState): the error of the failed attempt on a retry, else a generic error', function (t) {
  t.plan(4)
  const fake = () => ({ destroyed: true, on () { return this } })
  serve((req, res) => res.end('DATA'), (url, server) => {
    rock({ url, output: fake }, function (err) {
      t.equal(err?.message, 'opts.output returned a destroyed stream', 'first attempt: no previous error')
      serveCutOnce((url2, server2) => {
        let calls = 0
        rock({ url: url2, retryDelay: 1, output: () => (++calls === 1 ? new Writable({ write (chunk, enc, wcb) { wcb() } }) : fake()) }, function (err2) {
          t.equal(err2?.code, 'ECONNRESET', 'retry: the network error of the failed attempt')
          t.equal(calls, 2)
          t.pass('called back once')
          server2.closeAllConnections?.()
          server2.close()
          server.close()
        })
      })
    })
  })
})

test('an output() returning a destroyed stream releases a body still uploading (no file descriptor left open)', function (t) {
  t.plan(3)
  const server = http.createServer((req, res) => res.end('DATA')) // answers before reading the body
  server.listen(0, '127.0.0.1', () => {
    let body = null
    const createBody = () => { // a streamed upload which never ends by itself (like a large file)
      body = new Readable({ read () {} })
      body.push('first chunk')
      return body
    }
    const w = new Writable({ write (chunk, enc, wcb) { wcb() } })
    w.destroy()
    let calls = 0
    rock({ url: 'http://127.0.0.1:' + server.address().port, method: 'POST', body: createBody, output: () => w }, function (err) {
      calls++
      t.equal(err?.message, 'opts.output returned a destroyed stream')
      setTimeout(() => {
        t.equal(body.destroyed, true, 'the upload stream is destroyed')
        t.equal(calls, 1)
        server.closeAllConnections?.()
        server.close()
      }, 50)
    })
  })
})
