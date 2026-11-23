# Rock-req

### 5.3.2
  - Fix: the callback never fired when `output()` returned the same stream on every retry. After a network error, the retry wrote into the stream destroyed by the failed attempt and waited forever. Now, if `output()` returns a destroyed stream, the request stops right away and the callback gets the error. Returning a new stream on each call, as documented, still works as before.
  - Fix: the callback never fired when the output stream was created with `emitClose: false`. It now fires on `finish`.
  - Fix: the callback never fired when a server answered `101 Switching Protocols` to a normal request, even with a `timeout`. You now get an `EUNEXPECTEDUPGRADE` error, which is not retried. If you listen to `req.on('upgrade')` yourself, you still get the socket.
  - Fix: a synchronous `req.abort()` now calls the callback with a `socket hang up` error (`ECONNRESET`). Before, the callback was never called.

### 5.3.1
  - Security fix: an invalid redirect (`Location: ftp://x`, a bad port or a malformed URL) crashed the process with an uncaught exception.
    It now returns the error in the callback. Same for a retry that becomes invalid (e.g. changed by `beforeRequest`).
    An invalid first request still throws synchronously, like NodeJS `http.request`.
  - Security fix: on a redirect to another host, or from `https` to `http`, `proxy-authorization` and `x-auth-token` (OpenStack Swift) are now
    removed too, like `authorization` and `cookie`. The list can be changed with `extend({ sensitiveHeaders: [...] })`.
    A `307`/`308` still sends the body to the new location: use `followRedirects: false` for a request whose body contains secrets.

### 5.3.0
  - Fix: `maxRetry: N` now really means N retries on network errors (it was N - 1, so no retry at all with the default `maxRetry: 1`).
    Retries on HTTP codes are unchanged. A request that times out is now retried once by default, so it can take up to 2× `timeout`
    before the callback gets the error (failover to another server included).
  - Fix: a request destroyed by the user (`req.destroy()`, `req.abort()`) is never retried. It only stops the first request:
    once a redirect or a retry has started, destroying it has no effect (as before).
  - Body and output functions must return a new stream on each call: they are now called again on network-error retries too.
  - Retries wait `retryDelay * 2^n` plus a random jitter (exponential backoff), never more than the new option `retryMaxDelay`
    (default 2000ms). `EHOSTUNREACH` added to `retryOnError`.
  - On `429` and `503`, the `Retry-After` header (seconds or date) is respected. If it is greater than `retryMaxDelay`,
    the response is returned without retry.
  - New option `keepAliveTimeout` (default 5000ms like NodeJS `globalAgent`, `extend()` only): idle keep-alive sockets are closed
    after this delay (or the server `Keep-Alive: timeout` minus 1s), to avoid `ECONNRESET` / `socket hang up` on a socket closed by
    the server. In-flight requests are never aborted. Set 0 to keep the previous behaviour.
  - New option `decompress` (default `true`). With `decompress: false`, a gzip/deflate/br response is returned as received.
    Useful to download files stored compressed on S3 or Swift without altering them.
  - Fix: `HEAD`, `204`, `205`, `304` and `206` responses are never decompressed (`206` is a range of the compressed body).
    A request with a `range` header and no `accept-encoding` sends `accept-encoding: identity`.
  - Fix: a `303` redirect changes all methods except `GET`/`HEAD` to `GET` without body (RFC 9110). `301`/`302`/`307`/`308` unchanged.
  - `content-encoding: x-gzip` is decompressed like `gzip` (RFC 9110).
  - Tests pass on Node 16 to 26 (Node >= 24.22 groups same-tick writes into one HTTP chunk, nodejs/node#64987).

### 5.2.1
  - Improved README.md for NPM.com (reduced table width)

### 5.2.0
  - Added a promises interface with `rock.promises`
  - Added support for basic ESM import: `import rock from "rock-req";`
  - Added the option `jsonResponse <boolean>`.
    This forces JSON response parsing, or allows mixed responses even when `json = true`. Default: same as `json`. Note: `jsonResponse` cannot be set to `true` if `json = false`.
  - Updated CI for newer Node versions  
  - Made tests compatible with Node 24+
  - Updated benchmarks and all dependencies

### 5.1.3
  - Remove default request timeout when `keepAliveDuration` is used (was 3s by default)

### 5.1.2
  - Fix retry even if the socket is closed immediately on server side (socket hang up)

### 5.1.1
  - Accept empty response in JSON mode. Returned `data` is `null` in this case.

### 5.1.0
  - Add benchmark and replace NodeJS `pipeline` by traditional `pipe` (x2 faster)
  - Add default keep alive
  - One retry by default
  - Remove retry on error 500 by default

### 5.0.3
  - fix README.md on npm.com

### 5.0.2
  - Catch all errors even if the package is used with nock for example

### 5.0.1
  - On relative redirect, `beforeRequest` handler receives updated `opts`

### 5.0.0
  - First version of rock-req, fork of simple-get with a lot of new feature, and lighter
