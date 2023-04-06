
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
  - `maxRetry <number>` overwrite global maximum number of retries. Defaults to 0
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
    - `false` causes a new Agent with default values to be used.


### Input Stream

Rock-req requires that input stream is initialized in a function.

This function is invoked by rock-req for every request retry.
If something goes wrong, the old stream is destroyed.

```js
const rock = require('rock-req')
const fs = require('fs')

// opts contains options passed in rock(opts). DO NOT MODIFY IT
function createInputStream(opts) {
  return fs.createReadStream('input.txt');
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
const fs = require('fs')
const { finished } = require('stream')

// opts contains options passed in rock(opts). DO NOT MODIFY IT
// res  if the http response (res.statusCode, ...). DO NOT MODIFY IT and DO NOT CONSUME THE RES STREAM YOURSELF
function createOutputStream(opts, res) {

  const writer = fs.createWriteStream('test_gfg.txt') 
  // Internally, rock-req uses pipeline. If something goes wrong, the stream is destroyed automatically.
  // If you need to do some action (removing temporary files, ...), uses this native NodeJS method:
  const cleanup = finished(writer, (err) => {
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
  return writer
}

const opts = {
  url    : 'http://example.com',
  output : createOutputStream
}
rock(opts, function (err, res, data) {})
```

### Retry on failure

By default, rock-req retries with the following errors if `maxRetry > 1`

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
  url      : 'http://example.com',
  body     : 'this is the POST body',
  maxRetry : 2 // 0 is the default value (= no retries)
}
rock(opts, function (err, res, data) {} );
```


### Global options

Change default parameters globally, or create a new instance with specific paramaters (see below)

```js
rock.defaults = {
  headers       : {},
  maxRedirects  : 10,
  maxRetry      : 0,
  retryDelay    : 100, //ms
  retryOnCode   : [408, 429, 500, 502, 503, 504, 521, 522, 524 ],
  retryOnError  : ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED','EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN' ],
  // beforeRequest is called for each request, retry and redirect
  beforeRequest : (opts) => {
    // You can overwrite all these values:

    opts.protocol = 'https:' //  or 'http:' 
    opts.hostname = 'google.com';
    opts.port = 443;
    opts.path = '/mypage.html?bla=1';
    opts.auth = '';
    opts.remainingRetry; 
    opts.remainingRedirects;
    opts.headers = {};
    opts.body = {};
    opts.method = 'POST';
    
    // And read these values
    opts.url;
    opts.maxRetry;
    opts.maxRedirects;

    // opts must be returned
    return opts;
  },
}
```

### Extend and intercept retries

Create a new instance with specific parameter instead of modifying `rock.defaults`

By default, this new instance inherits values of the instance source if options are not overwritten. 
Internaly, only the first level of the option object is merged with `Object.assign(currentInstanceOption, newOptions)`.

Here is a basic example of `beforeRequest` interceptor to use [HAProxy as a forward proxy](https://www.haproxy.com/user-spotlight-series/haproxy-as-egress-controller/).

`beforeRequest` is always called on each redirect/retry.
  - on redirect, `opts.url` (and `hostname`, `port`, `protocol`, `path`) is updated to the new location
  - on retry, `opts.url` (and `hostname`, `port`, `protocol`, `path`) have the same value as they did when the rock-req was initially called


```js
const myInstance = rock.extend({
  beforeRequest: (opts) => {
    const { hostname, port, protocol, path } = opts;
    opts.protocol = 'http:';
    opts.hostname = '10.0.0.1';
    opts.port = 80;
    opts.path = `${protocol}/${hostname}/${port}/${path}`;
    return opts;
  },
  headers: {
    'Custom-header': 'x-for-proxy'
  }
});

myInstance.get('http://example.com', function (err, res, data) {})

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
rock(opts, function (err, res, data) {
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

rock(opts, function (err, res, data) {})
```


### One Quick Tip

It's a good idea to set the `'user-agent'` header so the provider can more easily
see how their resource is used.

```js
const rock = require('rock-req')
const pkg = require('./package.json')

rock({
  url : 'http://example.com',
  headers: {
    'user-agent': `my-module/${pkg.version} (https://github.com/username/my-module)`
  }
}, function (err, res, data) {})
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

rock(opts, function (err, res, data) {})
```

### Cookies

You can use the [`cookie`](https://github.com/jshttp/cookie) module to include
cookies in a request:

You can extend and create a new instance of rock-req to keep the cookie in header for each request.

```js
const rock = require('rock-req')
const cookie = require('cookie')

const opts = {
  url: 'http://example.com',
  headers: {
    cookie: cookie.serialize('foo', 'bar')
  }
}

rock(opts, function (err, res, data) {})
```

### Form data

You can use the [`form-data`](https://github.com/form-data/form-data) module to
create POST request with form data:

```js
const fs = require('fs')
const rock = require('rock-req')
const FormData = require('form-data')
const form = new FormData()

const opts = {
  url: 'http://example.com',
  body: () => {
    form.append('my_file', fs.createReadStream('/foo/bar.jpg'))
  }
}

rock.post(opts, function (err, res, data) {})
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
rock.post(opts, function (err, res, data) {})
```

### Specifically disallowing redirects

```js
const rock = require('rock-req')

const opts = {
  url: 'http://example.com/will-redirect-elsewhere',
  followRedirects: false
}
// res.statusCode will be 301, no error thrown
rock(opts, function (err, res, data) {})
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
const rock = require('rock-get')
const RateLimiter = require('limiter').RateLimiter
const limiter = new RateLimiter(1, 'second')

const rock = (opts, cb) => limiter.removeTokens(1, () => rock(opts, cb))
rock.concat = (opts, cb) => limiter.removeTokens(1, () => rock.concat(opts, cb))

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


## Breaking change for people coming from simplet-get

Rock-req is a fork of [simple-get](https://github.com/feross/simple-get)

- Rock-req concatenates chunks and returns the concatenated buffer/JSON in the third paramater of the callback.
  Why? because 80% of the time, we need to do simple request without streams.
  When you need to pipe the result to another stream, you must use `opts.output` parameter (see "Output Stream" in the doc)
- All streams must be created in a function. Rock-req return an error if it is not the case
  before: 
    `body = stream`   
  after
    `body = () => { const myStream = create(); return myStream; }` 


## Notes:

- [] replace deprecated `url.parse` by `new URL` but new URL is slower than url.parse. Let's see if Node 20 LTS is faster
- TODO agent keep Alive
- TODO le client doit avoir un socker timeout plus court que le proxy pour éviter qu'il requête dans une socket déjà tué par haproxy
- https://connectreport.com/blog/tuning-http-keep-alive-in-node-js/
- https://nodejs.org/dist/latest-v18.x/docs/api/http.html#http_class_http_agent
- TOdo test https://stackoverflow.com/questions/66442145/nodejs-stream-behaviour-pipeline-callback-not-called


# Supporters

<p>
  <a href="https://carbone.io" alt="Carbone.io - Efficient PDF / DOCX / XLSX / CSV / HTML / XML generator with templates and JSON">
    <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/carbone-logo.svg" alt="Carbone.io logo" height="60"/>
  </a>
</p>


Thank you [Feross Aboukhadijeh](https://github.com/feross) for inspiring us with `simple-get` 



