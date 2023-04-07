const rock = require('../')
const http = require('http')
const net = require('net')
const selfSignedHttps = require('self-signed-https')
const str = require('string-to-stream')
const test = require('tape')
const { pipeline , Writable, Readable, finished, PassThrough} = require('stream');

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
  t.plan(4 * 10 /* 9 + 1 success */ + 9 /* second try which is a success */ )
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

test('should not retry if maxRetry === 0', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 500
    res.end('response')
  })
  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 0,
      retryOnCode : [500]
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 500)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should not retry if maxRetry < 0', function (t) {
  t.plan(4)
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 500
    res.end('response')
  })
  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: -1,
      retryOnCode : [500]
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 500)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
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
    rock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 5
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 503)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
})

test('should use read default.retryOnError to check if rock need to retry or not', function (t) {
  t.plan(10)
  var nbTry = 0;
  const server = http.createServer(function (req, res) {
    t.equal(req.url, '/path')
    res.statusCode = 404
    nbTry++;
    res.end('response')
  })
  const myInstance = rock.extend({retryOnCode : [404]});
  server.listen(0, function () {
    const port = server.address().port
    myInstance({
      url: 'http://localhost:' + port + '/path',
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
    rock({
      url: 'http://localhost:' + port + '/path',
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
  var nbRequestTimeout = 1;
  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'POST')
    t.equal(req.headers['x-test'], '145')
    t.equal(req.headers['accept-encoding'], 'gzip, deflate, br')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      req.pipe(res)
      return
    }
    nbRequestTimeout--;
    setTimeout(function () {
      // response should not be sent
      res.end('response')
    }, 1000)
  })
  server.listen(0, function () {
    const port = server.address().port
    rock({
      url: 'http://localhost:' + port + '/path',
      body : 'body message',
      method : 'POST',
      headers : {'X-TEST' : '145'},
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
  var nbRequestTimeout = 1;
  const server = http.createServer(function (req, res) {
    t.equal(req.method, 'POST')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      req.pipe(res)
      return
    }
    nbRequestTimeout--;
    setTimeout(function () {
      // response should not be sent
      res.end('response')
    }, 1000)
  })
  const newInstance = rock.extend({ maxRetry : 2, timeout: 500 })
  server.listen(0, function () {
    const port = server.address().port
    newInstance.post('http://localhost:' + port + '/path', 'body message', function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'body message')
      server.close()
    })
  })
})

test('should retry if the error is coming from the server after receiving the first response', function (t) {
  t.plan(5)
  let nbTry = 0;
  const server = http.createServer(function (req, res) {
    nbTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    setTimeout(()=> {
      if (nbTry === 1) {
        t.equal(nbTry, 1)
        res.socket.destroy(new Error('ECONNRESET'))
      }
      else {
        res.end('6789');
      }
    }, 1000);
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  server.listen(0, function () {
    const port = server.address().port
    newInstance.concat('http://localhost:' + port, function (err, res, data) {
      t.error(err)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new INPUT stream on retry (error on server side)', function (t) {
  t.plan(13)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
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
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  const inputStreams = [];
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            this.push(this.data[this.it++])
          }
        });
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      method: 'POST'
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(nbDataChunkReceived, 4)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), '123456789')
      server.close()
    })
  })
})

test('should destroy and restart a new INPUT stream on retry (error on input stream)', function (t) {
  t.plan(17)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
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
        setTimeout(function() {
          res.end('6789')
        }, 200)
      }
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 })
  const inputStreams = []
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            if (this.it === 1 && nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET');
              _error.code = 'ECONNRESET';
              myReadStream.destroy(_error)
            }
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        });
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      method: 'POST',
      maxRetry : 2
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
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    if (nbServerTry === 1) {
      setTimeout(() => {
        res.end('12345')
      }, 2000)
    }
    else {
      res.end('realEnd')
    }
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    let nbClientFinishedInputStream = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = Readable.from(['yeah'], {objectMode: false})
        const cleanup = finished(myReadStream, (err) => {
          nbClientFinishedInputStream++
          t.error(err)
          cleanup();
        })
        return myReadStream;
      },
      method : 'POST',
      timeout : 500,
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
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.end('realEnd')
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = Readable.from(['yeah'], {objectMode: false})
        myReadStream.destroy(new Error('Not readable'));
        return myReadStream;
      },
      method : 'POST',
      timeout : 500,
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
  t.plan(19)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
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
        setTimeout(function() {
          res.end('6789')
        }, 200)
      }
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 })
  const inputStreams = []
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    let nbClientOutputStreamCreated = 0;
    let outputChunks = [];
    const opts = {
      url: 'http://localhost:' + port,
      output : (opts, res) => {
        outputChunks = [];
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({ 
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString()); 
            wcb();
          }
        })
        return myWriteStream;
      },
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            if (this.it === 1 && nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET');
              _error.code = 'ECONNRESET';
              myReadStream.destroy(_error)
            }
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        });
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      method: 'POST',
      maxRetry : 2
    }
    newInstance(opts, function (err, res, data) {
      t.error(err)
      t.equal(nbServerTry, 2)
      t.equal(nbClientInputStreamCreated, 2)
      t.equal(nbClientOutputStreamCreated, 1)
      t.equal(nbDataChunkReceived, 3)
      t.equal(inputStreams[0].destroyed, true)
      t.equal(inputStreams[1].destroyed, true)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join('').toString(), '123456789')
      server.close()
    })
  })
})

test('should return an error and not retry if the OUTPUT stream is destroyed since the beginning', function (t) {
  t.plan(5)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.end('realEnd')
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  server.listen(0, function () {
    const port = server.address().port
    let nbClientOutpoutStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: 'yes',
      output : (opts, res) => {
        nbClientOutpoutStreamCreated++;
        outputChunks = [];
        const myWriteStream = new Writable({ 
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString()); 
            wcb();
          }
        })
        myWriteStream.destroy(new Error('Not writable'))
        return myWriteStream;
      },
      method : 'POST',
      timeout : 500,
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
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
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
        setTimeout(function() {
          res.end('6789')
        }, 200)
      }
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 })
  const inputStreams = []
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    let nbClientOutputStreamCreated = 0;
    let outputChunks = [];
    const opts = {
      url: 'http://localhost:' + port,
      output : (opts, res) => {
        outputChunks = [];
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({ 
          write (chunk, enc, wcb) {
            if (nbClientInputStreamCreated === 1) {
              const _error = new Error('ECONNRESET');
              _error.code = 'ECONNRESET';
              myWriteStream.destroy(_error)
            }
            outputChunks.push(chunk.toString()); 
            wcb();
          }
        })
        return myWriteStream;
      },
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            setTimeout(() => {
              this.push(this.data[this.it++])
            }, 20)
          }
        });
        myReadStream.on('error', (e) => {
          t.ok(e instanceof Error)
        })
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      method: 'POST',
      maxRetry : 2
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
  t.plan(14)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
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
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  const inputStreams = [];
  let nbClientOutputStreamCreated = 0;
  let outputChunks = [];
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            this.push(this.data[this.it++])
          }
        });
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      output: (opts, res) => {
        outputChunks = [];
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({ 
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString()); 
            wcb();
          }
        })
        return myWriteStream;
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
      t.equal(nbDataChunkReceived, 4)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join(''), '123456789')
      server.close()
    })
  })
})

test('should accept using finished/cleanup function of NodeJS on OUTPUT stream on retry (error on server side)', function (t) {
  t.plan(18)
  
  let nbServerTry = 0;
  let nbDataChunkReceived = 0;
  const server = http.createServer(function (req, res) {
    nbServerTry++;
    res.statusCode = 200
    res.write('12345');
    t.equal(req.url, '/')
    const chunks = [];
    req.on('data', (chunk) => {
      nbDataChunkReceived++;
      chunks.push(chunk.toString());
      if (nbDataChunkReceived === 1) {
        t.equal(chunk.toString(), 'abcde')
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
    });
  })
  const newInstance = rock.extend({ maxRetry : 2 });
  const inputStreams = [];
  let nbClientOutputStreamCreated = 0;
  let nbClientOutputFinishedStream = 0;
  let outputChunks = [];
  server.listen(0, function () {
    const port = server.address().port
    let nbClientInputStreamCreated = 0;
    const opts = {
      url: 'http://localhost:' + port,
      body: (opts) => {
        nbClientInputStreamCreated++;
        const myReadStream = new Readable({
          construct(cb) {
            this.data = ['abcde', 'fghij', null]
            this.it = 0
            cb()
          },
          read(size) {
            this.push(this.data[this.it++])
          }
        });
        inputStreams.push(myReadStream)
        return myReadStream;
      },
      output: (opts, res) => {
        outputChunks = [];
        nbClientOutputStreamCreated++
        const myWriteStream = new Writable({ 
          write (chunk, enc, wcb) {
            outputChunks.push(chunk.toString()); 
            wcb();
          }
        })
        const cleanup = finished(myWriteStream, (err) => {
          nbClientOutputFinishedStream++
          if (nbClientOutputFinishedStream === 1) {
            t.ok(err instanceof Error)
            t.equal(err.code, 'ECONNRESET')
          }
          else {
            t.error(err)
          }
          cleanup();
        })
        return myWriteStream;
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
      t.equal(nbDataChunkReceived, 4)
      t.equal(res.statusCode, 200)
      t.equal(outputChunks.join(''), '123456789')
      server.close()
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
    const request = rock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
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
    rock({
      url: 'http://localhost:' + port + '/path',
      maxRetry: 2
    }, function (err, res, data) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(data.toString(), 'response')
      server.close()
    })
  })
}

