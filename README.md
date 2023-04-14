
<p align="center">
  <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/rock-req-logo.svg" alt="rock-req logo" height="120"/>
</p>

<h1 align="center" style="border-bottom:none; font-size: 2.2em;">Rock-req.js</h1>

<p align="center">⭐️⭐️ Ensure your HTTP requests always reach their destination as <b>efficiently</b> as possible! ⭐️⭐️</p>

[![npm][npm-image]][npm-url]  [![ci][ci-image]][ci-url]  [![javascript style guide][standard-image]][standard-url]

[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com
[npm-image]: https://img.shields.io/npm/v/rock-req.svg
[npm-url]: https://npmjs.org/package/rock-req
[ci-url]: https://github.com/carboneio/rock-req/actions
[ci-image]: https://img.shields.io/github/actions/workflow/status/carboneio/rock-req/ci.yml?branch=master

## 🔥 Why?

In most existing libraries (2023):

- Managing **reliable retries** is difficult, tricky with streams and not battle-tested
- Using **multiple forward proxies** has several benefits like **higher availability** and **increased bandwidth** but 
  **Intercepting retries** to use another Egress controller between two requests is not possible.
- Many request libraries are heavy: node-fetch, superagent, needle, got, axios, request
- Lightweight alternatives are not as light as they claim due to dependencies (simple-get, tiny-req, puny-req, phin, ...)

⚡️ **Rock-req** solves these problems with only **150 lines of code** and **zero dependencies**

It also supports many features:

- Follows redirects
- Handles **gzip/deflate/brotli** responses
- Modify defaults
- Extend and create new instances
- Automatically destroy input/output **stream** on error and premature close event
- **Advanced retries**
- URL Rewrite
- **Ultra-fast (> 20k req/s)**
- Keep Alive by default (3000ms)
- Composable
- Timeouts
- HTTPS / HTTP
- Composes well with npm packages for features like cookies, proxies, form data, & OAuth
- Keep 98% of the `simple-get` API (fork source)

When the callback is called, the request is 100% finished, even with streams.


## 🚀 Benchmark Rock-req vs got, axios, node-fetch, phin, simple-get, superagent, ...

Stop using "slow by-default" and "false-light" HTTP request libraries!


| Library      | Speed            | Size deps inc. |
| ------------ |-----------------:| --------------:|
| rock-req 🙋‍♂️  | 21797 req/s      | 144 LOC        |
| simple-get   | 3260 req/s       |   317 LOC      |
| axios        | 4910 req/s       | 13983 LOC      |
| got          | 1762 req/s       |  9227 LOC      |
| fetch        | 2102 req/s       | 13334 LOC      |
| request      | 1869 req/s       | 46572 LOC      |
| superagent   | 2100 req/s       | 16109 LOC      |
| phin         | 1164 req/s       |   331 LOC      |
| undici*      | 24378 req/s      | 16225 LOC      |


> `undici` is a low-level API, faster alternative to the native NodeJS http module. It is the glass ceiling limit for NodeJS.

> `rock-req` uses only the native NodeJS http module and provides many high-level features, a lot more than `phin` and `simple-get` with fewer lines

> Tested with NodeJS 18.x LTS on Macbook Pro M1 Max


## Install

```
  npm install rock-req
```

## Usage

All functions accept two or three parameters:

```js
  const rock = require('rock-req')
  rock(optsOrURL [, bodyOrStreamFn], callback)
````

- `optsOrURL` can be an object or a the URL 
- `bodyOrStreamFn` can be a buffer/string/object or a function returning an input stream for sending the body of POST/PUT/PATCH/DELETE requests
- `callback(err, res, data)` called only when everything is finished (even with streams).


### GET, HEAD requests

```js
// res is the server response, already consumed by rock-req. The result is in data
rock.get('http://ex.com', (err, res, data) => {
  console.log(res.statusCode) // 200
  console.log(data) // Buffer('server response')
})
```

Alternative syntax:

```js
rock({ method: 'GET', url: 'http://ex.com' }, function (err, res, data) {} )
// OR
rock.concat({ method: 'GET', url: 'http://ex.com' }, function (err, res, data) {} )
```

Head requests:

```js
rock.head('http://example.com', (err, res, data) => {})
```

### POST, PUT, PATCH, DELETE requests

Use the second paramater to pass the body:

```js
rock.post('http://ex.com', 'POST body', (err, res, data) => {})
```

Alternative syntax:

```js
rock({ method: 'POST', url : 'http://ex.com', body : 'POST body' }, function (err, res, data) {} )
```

### JSON request shortcuts

Automatically serialize/deserialize request and response with JSON with `getJSON`, `putJSON`, `postJSON`, `deleteJSON`, ...

```js
rock.putJSON('http://ex.com', { id : 123 }, (err, res, data) => {
  console.log(data) // already JSON.parsed
})
```

Alternative syntax:

```js
rock({ method: 'PUT', url: 'http://ex.com', body: { id : 123 }, json: true }, function (err, res, data) {} )
```

### All options:


```js
const opts = {
  url    : 'http://example.com',
  method : 'POST',
  body   : 'this is the POST body',
  headers: {
    'user-agent': 'my cool app'
  }
}
rock(opts, function (err, res, data) {} )
```

**opts** can contain any value of NodeJS http.request with rock-req parameters. Here are the most used one:

  - `maxRedirects <number>`overwrite global maximum number of redirects. Defaults to 10
  - `maxRetry <number>` overwrite global maximum number of retries. Defaults to 1
  - `followRedirects <boolean>` do not follow redirects
  - `body <buffer> | <string> | <object> | <function>` body to post
  - `json <boolean>` automatically stringify/parse request/response Default : false
  - `url <string>` the destination URL
  - `method <string>` A string specifying the HTTP request method. Default: 'GET'.
  - `headers <object>` An object containing request headers. Default: 'accept-encoding': 'gzip, deflate, br'
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

If something goes wrong, the Readable stream is destroyed automatically and the error can be captured with `'error'` event or `stream.finished` (optional).

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

If something goes wrong, the Writable stream is destroyed automatically and the error can be captured with `'error'` event or `stream.finished` (optional).

```js
const rock = require('rock-req')
const fs = require('fs')

// opts contains options passed in rock(opts). DO NOT MODIFY IT
// res  if the http response (res.statusCode, ...). DO NOT MODIFY IT and DO NOT CONSUME THE RES STREAM YOURSELF
function createOutputStream(opts, res) {

  const writer = fs.createWriteStream('test_gfg.txt') 
  // If you need to do some action (removing temporary files, ...), uses this native NodeJS method:
  writer.on('error', (e) => { /* clean up your stuff */ })
  return writer
}

const opts = {
  url    : 'http://example.com',
  output : createOutputStream
}
rock(opts, function (err, res) {})
```

### Retry on failure

By default, rock-req retries with the following errors if `maxRetry > 0`.

The callback is called when the request succeed or all retries are done

```js 
const rock = require('rock-req');

// default values can be overwritten like this:
rock.defaults.retryOnCode = [
  408, /* Request Timeout */
  429, /* Too Many Requests */
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
  maxRetry : 1
}
rock(opts, function (err, res, data) {} );
```


### Global options & Extend

Change default parameters globally (not recommended), or create a new instance with specific paramaters (see below)

```js
rock.defaults = {
  headers           : { 'accept-encoding': 'gzip, deflate, br' },
  maxRedirects      : 10,
  maxRetry          : 1,
  retryDelay        : 10, //ms
  retryOnCode       : [408, 429, 502, 503, 504, 521, 522, 524 ],
  retryOnError      : ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED','EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN' ],
  // beforeRequest is called for each request, retry and redirect
  beforeRequest : (opts) => {
    // There options can be overwritted (= parsed opts.url)
    opts.protocol = 'https:' //  or 'http:' 
    opts.hostname = 'google.com';
    opts.port = 443;
    opts.path = '/mypage.html?bla=1#hash';
    opts.auth = '';
    opts.headers = {};
    opts.body = {};
    opts.method = 'POST';
    opts.remainingRetry; 
    opts.remainingRedirects;
    opts.agent = otherHttpAgent;
    
    // READ-ONLY options (not exhaustive)
    opts.url; // DOT NOT OVERWRITE
    opts.maxRetry;
    opts.maxRedirects;
    opts.prevError; // error of previous request on retry
    opts.prevStatusCode; // HTTP status code of previous request on retry/redirect

    // opts must be returned
    return opts;
  },
}
```

Create a new instance with specific parameters instead of modifying global `rock.defaults`.

By default, this new instance inherits values of the instance source if options are not overwritten. 
Headers are merged. Then only the first level of the options object is merged (no deep travelling in sub-objects or arrays).

The `keepAliveDuration` can be changed only with `extend` method because `rock-req` creates new http Agent on new instances.

```js
const myInstance = rock.extend({
  keepAliveDuration : 0, // Change keep alive duration. Default to 3000ms. Set 0 to deactivate keep alive.
  headers: {
    'Custom-header': 'x-for-proxy'
  },
  timeout : 1000
});

myInstance.get('http://example.com', function (err, res, data) {})
```

### Intercept retries for Higher Availability / Higher bandwidth 

`beforeRequest` is always called on each request, each redirect and each retry.
  - on redirect, `opts.url` (and `hostname`, `port`, `protocol`, `path`) is updated to the new location. `opts.url` is null if it is a relative redirect.
  - on retry, `opts.url` (and `hostname`, `port`, `protocol`, `path`) have the same value as they did
    when the rock-req was initially called.

For example, you can dynamically change the http Agent to use a another proxy on each request.
Be careful, in this case, you must provide the right http/https Agent if there is a redirection from http to https.
Otherwise, rock-req automatically replaces your Agent with the correct one if the protocol changes after redirection.

Or, you can rewrite the URL if you want to use [HAProxy as a forward proxy](https://www.haproxy.com/user-spotlight-series/haproxy-as-egress-controller/).


```js
const myInstance = rock.extend({
  beforeRequest: (opts) => {
    const { hostname, port, protocol, path } = opts;
    opts.protocol = 'http:';
    opts.hostname = '10.0.0.1';
    opts.port = 80;
    opts.path = `${hostname}/${port}${path}`;
    return opts;
  }
});

myInstance.get('http://example.com', function (err, res, data) {})

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
  - before:  `body = stream`   
  - after `body = () => { const myStream = create(); return myStream; }` 


## TODO:

- [ ] replace deprecated `url.parse` by `new URL` but new URL is slower than url.parse. Let's see if Node 20 LTS is faster
- [ ] add advanced timeout (response timeout)
- [ ] test prevError
- [ ] test HTTP abort signal option
- [ ] test input stream error with 502 error retry. Does stream.resume destroy  all streams?
- [ ] promisify
- [ ] typescript type
- [ ] NodesJS 19 doesn't need agent.timeout to exit https://github.com/nodejs/node/issues/47228  https://github.com/nodejs/node/issues/2642


# Supporters

This packaged in maintained by Carbone:

<p>
  <a href="https://carbone.io" alt="Carbone.io - Efficient PDF / DOCX / XLSX / CSV / HTML / XML generator with templates and JSON">
    <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/carbone-logo.svg" alt="Carbone.io logo" height="60"/>
  </a>
</p>


Thank you [Feross Aboukhadijeh](https://github.com/feross), creator of `simple-get` 



