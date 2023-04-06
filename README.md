
<p align="center">
  <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/rock-req-logo.svg" alt="rock-req logo" height="120"/>
</p>

<h1 align="center" style="border-bottom:none; font-size: 2.2em;">Rock-req.js</h1>

<p align="center">Ensure your HTTP requests always reach their destination!</p>

[![javascript style guide][standard-image]][standard-url]

[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com


## 🔥 Why should you need this?

In most libraries:

- Managing **reliable retries** is difficult, tricky with streams and not battle-tested
- Using **multiple forward proxies** has several benefits like **higher availability** and **increased bandwidth** but 
  **Intercepting retries** to use another Egress controller between two requests is not possible.
- Many request libraries are heavy: node-fetch, superagent, needle, got, axios, request
- Lightweight alternatives are not as light as they claim due to dependencies (simple-get, tiny-req, puny-req, ...)

⚡️ **Rock-req** solves these problems with only **150 lines of code** and **zero dependencies**

It also supports many features:

- Follows redirects
- Handles gzip/deflate/brotli responses
- Modify defaults
- Extend and create new instances
- Automatically destroy input/output stream on error (pipeline)
- Composable
- Timeouts
- HTTPS / HTTP
- Composes well with npm packages for features like cookies, proxies, form data, & OAuth
- Typescript definition
- Keep 98% of the `simple-get` API (fork source)

Like NodeJS pipeline, when the callback is called, the request is 100% finished, even with streams.

## Usage


### Install

```
  npm install rock-req
```

### GET, HEAD requests

Here is how to do a simple get:


```js
const rock = require('rock-req')

rock.get('http://example.com', function (err, res, data) {
  if (err) throw err
  console.log(data) // Buffer('this is the server response')
})
```

Alternatives syntax:

```js
rock('http://example.com', function (err, res, data) {} )
// or
const opts = {
  url   : 'http://example.com',
  method: 'GET'
}
// or
rock(opts, function (err, res, data) {} )
// or
rock.get(opts, function (err, res, data) {} )
```

### POST, PUT, PATCH, HEAD, DELETE requests

// TODO


```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com',
  body: 'this is the POST body'
}
rock.post(opts, body, function (err, res, data) {
  if (err) throw err
  console.log(data) // Buffer('this is the server response')
})

rock('http://example.com', function (err, res, data) {
  // res is the 
  if (err) throw err
  console.log(res.statusCode) // 200
  console.log(data) // Buffer('this is the server response')
})
```

### GET, POST, PUT, PATCH, HEAD, DELETE

For `POST`, call `rock.post` or use option `{ method: 'POST' }`.

```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com',
  body: 'this is the POST body'
}
rock.post(opts, function (err, res, data) {
  if (err) throw err
  console.log(data) // Buffer('this is the server response')
})
```

Alternative syntax:

```js
  rock.post(opts, body, function (err, res, data) {} )
  rock.post('http://example.com', body, function (err, res, data) {} )
```

### Complex example with all options:

```js
const rock = require('rock-req')

rock({
  url    : 'http://example.com',
  method : 'POST',
  body   : 'this is the POST body',
  headers: {
    'user-agent': 'my cool app'
  }
}, function (err, res, data) {
  if (err) throw err

  // All properties/methods from http.IncomingResponse are available,
  // even if a gunzip/inflate transform stream was returned.
  console.log(res.headers)
  console.log(data)
})
```

**opts** can contain any value of NodeJS http.request with. Here are the most used one:

  - `maxRedirects <number>`overwrite global maximum number of redirects. Defaults to 10
  - `maxRetry <number>` overwrite global maximum number of retries. Defaults to 1
  - `body`
  - `json`
  - `url`
  - `method <string>` A string specifying the HTTP request method. Default: 'GET'.
  - `headers <Object>` An object containing request headers.
  - `timeout <number>`: A number specifying the socket timeout in milliseconds.
  - `auth <string>` Basic authentication ('user:password') to compute an Authorization header.
  - `port <number>` Port of remote server. Default: defaultPort if set, else 80.
  - `host <string>` A domain name or IP address of the server to issue the request to. Default: 'localhost'.
  - `hostname <string>` Alias for host.
  - `path <string>` Request path. Should include query string if any. E.G. '/index.html?page=12'. 
  - `protocol <string>` Protocol to use. Default: 'http:'.
  - `setHost <boolean>`: Specifies whether or not to automatically add the Host header. Defaults to true.
  - `agent <http.Agent> | <boolean>` Controls Agent behavior. Possible values:
    - `undefined` (default): use http.globalAgent for this host and port.
    - `Agent object`: explicitly use the passed in Agent.
    - `false: causes a new Agent with default values to be used.


### Input Stream

Rock-req requires that input stream is initialized in a function.
This function is invoked by rock-req for every request retry.
If something goes wrong, the old stream is destroyed.

```js
const rock = require('rock-req')
const { Readable } = require('stream');

/**
 * Initializes the input stream.
 *
 * @param  {Object} opts  contains all request options
 *                        with the current counter `remainingRetry` and `remainingRedirect``
 *                        DO NOT MODIFY
 * @return {Readable}
 */
function createInputStream(opts) {
  // Create the stream. It can fs.readFile, ...
  const myReadStream = new Readable({
    construct(cb) {
      this.data = ['12345', '6789', null]
      this.it = 0
      cb()
    },
    read(size) {
      this.push(this.data[this.it++])
    }
  });
  // It must return the created stream. Otherwise, the request is cancel with an error
  return myReadStream
}

const opts = {
  url : 'http://example.com',
  body: createInputStream
}
rock(opts, function (err, res, data) {})
```

Alternative syntax:

```js
  rock.post('http://example.com', createInputStream, function (err, res, data) {})
  // or with more object options:
  rock.post(opts, createInputStream, function (err, res, data) {})
```



### Output Stream

Rock-req requires that output stream is initialized in a function.
This function is invoked by rock-req for every request retry.

```js

const rock = require('rock-req')
const { Writable, finished } = require('stream')

/**
 * Initializes the output stream.
 *
 * @param  {Object} opts  contains all request options
 *                        with the current counter `remainingRetry` and `remainingRedirect``
 *                        DO NOT MODIFY
 * @param  {Object} res   http response (res.statusCode, ...)
 *                        DO NOT MODIFY
 *                        DO NOT CONSUME THE STREAM, rockreq pipes your write stream.
 * @return {Writable}
 */
function createOutputStream(opts, res) {
  // Create the stream. It can be fs.createWriteStream, ...
  const myWriteStream = new Writable({ 
    write (chunk, enc, wcb) {
      chunks.push(chunk); wcb()
    }
  })
  // Internally, rock-req uses pipeline. If something goes wrong, the stream is destroyed automatically.
  // If you need to do some action (removing temporary files, ...), uses this native NodeJS method:
  const cleanup = finished(myWriteStream, (err) => {
    if (err) {
      // clean up things 
    } 
    // When using the finished() method in NodeJS, it's important to be aware that it can leave some event listeners 
    // (specifically, the 'error', 'end', 'finish', and 'close' events) hanging around even after this callback function has been called.
    // This is intentional, as it helps prevent unexpected crashes if an error occurs due to incorrect stream implementations.
    // However, if you don't want these event listeners to stick around after the callback function has been called,
    // you can use the cleanup function that's returned by stream.finished() to remove them. 
    // You'll need to explicitly call this cleanup function within your callback function to ensure that the event listeners get removed properly.
    cleanup();
  });
  // It must return a Writable stream. Otherwise, the request is cancel with an error
  return myWriteStream
}

const opts = {
  url    : 'http://example.com',
  output : createOutputStream
}
rock(opts, function (err, res) {
  // an optional callback is called when the process is finished
})
```

### Retry on failure

By default, rock-req retries with the following errors.

```js 
const rock = require('rock-req');

// default values can be overwritten like this:
rock.defaults.retryOnCode = [
  408, /* Request Timeout */
  429, /* Too Many Requests */
  500, /* Internal Server Error */
  502, /* Bad Gateway */
  503, /* Service Unavailable */
  504, /* Gateway Timeout*/
  521, /* Web Server Is Down*/
  522, /* Cloudflare Connection Timed Out */
  524  /* Cloudflare A Timeout Occurred */
];
rock.defaults.retryOnError = [
  'ETIMEDOUT', /* One of the timeout limits was reached. */
  'ECONNRESET', /* The connection was forcibly closed. */
  'EADDRINUSE', /* Could not bind to any free port */
  'ECONNREFUSED', /* The connection was refused by the server. */
  'EPIPE', /* The remote side of the stream being written has been closed. */
  'ENOTFOUND', /* Could not resolve the hostname to an IP address. */
  'ENETUNREACH', /*  No internet connection. */
  'EAI_AGAIN' /* DNS lookup timed out. */
];

const opts = {
  url     : 'http://example.com',
  body    : 'this is the POST body',
  maxRetry: 2 // default value. 0 = deactivate retry
}
rock.post(opts, function (err, res) { });

```

### Global options

Change default parameters globally, or create a new instance with specific paramaters (see below)

```js
rock.defaults = {
  headers       : {},
  maxRedirects  : 10,
  maxRetry      : 2,
  retryDelay    : 100, //ms
  retryOnCode   : [408, 429, 500, 502, 503, 504, 521, 522, 524 ],
  retryOnError  : ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED','EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN' ],
  // WARNING: beforeRequest is also called for each retry/redirect
  beforeRequest : (parsedOpts) => {
    // parsedOpts is the object parsed by url.parse, with all paramaters of the query
    parsedOpts.protocol = 'https:';
    parsedOpts.hostname = 'google.com';
    parsedOpts.port = 443;
    parsedOpts.path = '/mypage.html?bla=1';
    parsedOpts.auth = '';
    parsedOpts.maxRetry = 2;
    parsedOpts.maxRedirects = 10;
    parsedOpts.remainingRetry = 1;
    parsedOpts.remainingRedirects = 9;
    // and all paramaters passed, except opts.url.
    parsedOpts.headers = {};
    parsedOpts.body = {};
    parsedOpts.method = {}; //...
    return parsedOpts;
  },
}
```

### Extend and intercept retries

Create a new instance with specific parameters. 

By default, this new instance inherits values of the instance source if options are not overwritten. 
Internaly, only the first level of the option object is merged with `Object.assign(currentInstanceOption, newOptions)`.

Here is a basic example of `beforeRequest` interceptor to use [HAProxy as a forward proxy](https://www.haproxy.com/user-spotlight-series/haproxy-as-egress-controller/).

`beforeRequest` is always called on each redirect/retry.
  - on redirect, `opts.url` (and `hostname`, `port`, `protocol`, `path`) is updated to the new location
  - on retry, `opts.url` (and `hostname`, `port`, `protocol`, `path`) have the same value as they did when the rock-req was initially called


```js
const myInstance = rock.extend({
  beforeRequest: (parsedOpts) => {
    const { hostname, port, protocol, path } = parsedOpts;
    parsedOpts.protocol = 'http:';
    parsedOpts.hostname = '10.0.0.1';
    parsedOpts.port = 80;
    parsedOpts.path = `${protocol}/${hostname}/${port}/${path}`;
    return parsedOpts;
  },
  headers: {
    'Custom-header': 'x-for-proxy'
  }
});

// Then this instance can be used in your app
myInstance.get()

```


### JSON

You can serialize/deserialize request and response with JSON:

```js
const rock = require('rock-req')

const opts = {
  method: 'POST',
  url: 'http://example.com',
  body: {
    key: 'value'
  },
  json: true
}
rock.concat(opts, function (err, res, data) {
  if (err) throw err
  console.log(data.key) // `data` is an object
})
```

### Timeout

You can set a timeout (in milliseconds) on the request with the `timeout` option.
If the request takes longer than `timeout` to complete, then the entire request
will fail with an `Error`.

```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com',
  timeout: 2000 // 2 second timeout
}

rock(opts, function (err, res) {})
```


### One Quick Tip

It's a good idea to set the `'user-agent'` header so the provider can more easily
see how their resource is used.

```js
const rock = require('rock-req')
const pkg = require('./package.json')

rock('http://example.com', {
  headers: {
    'user-agent': `my-module/${pkg.version} (https://github.com/username/my-module)`
  }
})
```

### Proxies

You can use the [`tunnel`](https://github.com/koichik/node-tunnel) module with the
`agent` option to work with proxies:

```js
const rock = require('rock-req')
const tunnel = require('tunnel')

const opts = {
  url: 'http://example.com',
  agent: tunnel.httpOverHttp({
    proxy: {
      host: 'localhost'
    }
  })
}

rock(opts, function (err, res) {})
```

### Cookies

You can use the [`cookie`](https://github.com/jshttp/cookie) module to include
cookies in a request:

```js
const rock = require('rock-req')
const cookie = require('cookie')

const opts = {
  url: 'http://example.com',
  headers: {
    cookie: cookie.serialize('foo', 'bar')
  }
}

rock(opts, function (err, res) {})
```

### Form data

You can use the [`form-data`](https://github.com/form-data/form-data) module to
create POST request with form data:

```js
const fs = require('fs')
const rock = require('rock-req')
const FormData = require('form-data')
const form = new FormData()

form.append('my_file', fs.createReadStream('/foo/bar.jpg'))

const opts = {
  url: 'http://example.com',
  body: form
}

rock.post(opts, function (err, res) {})
```

#### Or, include `application/x-www-form-urlencoded` form data manually:

```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com',
  form: {
    key: 'value'
  }
}
rock.post(opts, function (err, res) {})
```

### Specifically disallowing redirects

```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com/will-redirect-elsewhere',
  followRedirects: false
}
// res.statusCode will be 301, no error thrown
rock(opts, function (err, res) {})
```

### Basic Auth

```js
const user = 'someuser'
const pass = 'pa$$word'
const encodedAuth = Buffer.from(`${user}:${pass}`).toString('base64')

rock('http://example.com', {
  headers: {
    authorization: `Basic ${encodedAuth}`
  }
})
```

### OAuth

You can use the [`oauth-1.0a`](https://github.com/ddo/oauth-1.0a) module to create
a signed OAuth request:

```js
const rock = require('rock-req')
const crypto  = require('crypto')
const OAuth = require('oauth-1.0a')

const oauth = OAuth({
  consumer: {
    key: process.env.CONSUMER_KEY,
    secret: process.env.CONSUMER_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
})

const token = {
  key: process.env.ACCESS_TOKEN,
  secret: process.env.ACCESS_TOKEN_SECRET
}

const url = 'https://api.twitter.com/1.1/statuses/home_timeline.json'

const opts = {
  url: url,
  headers: oauth.toHeader(oauth.authorize({url, method: 'GET'}, token)),
  json: true
}

rock(opts, function (err, res) {})
```

### Throttle requests

You can use [limiter](https://github.com/jhurliman/node-rate-limiter) to throttle requests. This is useful when calling an API that is rate limited.

```js
const rockReq = require('simple-get')
const RateLimiter = require('limiter').RateLimiter
const limiter = new RateLimiter(1, 'second')

const rock = (opts, cb) => limiter.removeTokens(1, () => rockReq(opts, cb))
rock.concat = (opts, cb) => limiter.removeTokens(1, () => rockReq.concat(opts, cb))

var opts = {
  url: 'http://example.com'
}

rock.concat(opts, processResult)
rock.concat(opts, processResult)

function processResult (err, res, data) {
  if (err) throw err
  console.log(data.toString())
}
```



### TODO

- [] replace deprecated `url.parse` by `new URL` but new URL is slower than url.parse. Let's see if Node 20 LTS is faster



## How to migrate from simple-get

Streams must be created wuth a function!

body = stream 

body = () => { create stream }

The API 


- Make Managing reliable retries is difficult (tricky with streams), 
- Intercept retries to use a different forward proxy path
- Many requests libraries are heavy: node-fetch, superagent, needle, got, axios, request
- Lightweight alternatives are not as light as they claim due to dependencies (simple-get, tiny-req, puny-req, ...)
- Use [HAProxy as a forward proxy](https://www.haproxy.com/user-spotlight-series/haproxy-as-egress-controller/) is difficult because it requires URL rewritting




##
  - Rmeove deprecated feature of NodeJS req.abort
  - Fix redirect
  - HA proxy
  - Sending a 'Connection: keep-alive' will notify Node.js that the connection to the server should be persisted until the next request.


// TODO agent keep Alive
// TODO le client doit avoir un socker timeout plus court que le proxy pour éviter qu'il requête dans une socket déjà tué par haproxy
// https://connectreport.com/blog/tuning-http-keep-alive-in-node-js/

https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_class_http_agent

// TOdo test https://stackoverflow.com/questions/66442145/nodejs-stream-behaviour-pipeline-callback-not-called


# Supporters

Thank you  Thank you [Feross Aboukhadijeh](https://github.com/feross).



