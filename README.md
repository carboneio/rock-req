# simple-get [![ci][ci-image]][ci-url] [![npm][npm-image]][npm-url] [![downloads][downloads-image]][downloads-url] [![javascript style guide][standard-image]][standard-url]

[ci-image]: https://img.shields.io/github/workflow/status/feross/simple-get/ci/master
[ci-url]: https://github.com/feross/simple-get/actions
[npm-image]: https://img.shields.io/npm/v/simple-get.svg
[npm-url]: https://npmjs.org/package/simple-get
[downloads-image]: https://img.shields.io/npm/dm/simple-get.svg
[downloads-url]: https://npmjs.org/package/simple-get
[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com

### Simplest way to make http get requests

## features

This module is the lightest possible wrapper on top of node.js `http`, but supporting these essential features:

- follows redirects
- automatically retries on error
- create new instance
- extend with global header, URL rewritting, 
- composable
- automatically handles gzip/deflate responses
- supports HTTPS
- supports specifying a timeout
- supports convenience `url` key so there's no need to use `url.parse` on the url when specifying options
- composes well with npm packages for features like cookies, proxies, form data, & OAuth

All this in < 100 lines of code.

## install

```
npm install simple-get
```

## usage

Note, all these examples also work in the browser with [browserify](http://browserify.org/).


### simple GET request

Doesn't get easier than this:

```js
const get = require('simple-get')

get('http://example.com', function (err, res) {
  if (err) throw err
  console.log(res.statusCode) // 200
  res.pipe(process.stdout) // `res` is a stream
})
```

### even simpler GET request

If you just want the data, and don't want to deal with streams:

```js
const get = require('simple-get')

get.concat('http://example.com', function (err, res, data) {
  if (err) throw err
  console.log(res.statusCode) // 200
  console.log(data) // Buffer('this is the server response')
})
```

### POST, PUT, PATCH, HEAD, DELETE support

For `POST`, call `get.post` or use option `{ method: 'POST' }`.

```js
const get = require('simple-get')

const opts = {
  url: 'http://example.com',
  body: 'this is the POST body'
}
get.post(opts, function (err, res) {
  if (err) throw err
  res.pipe(process.stdout) // `res` is a stream
})
```

#### A more complex example:

```js
const get = require('simple-get')

get({
  url: 'http://example.com',
  method: 'POST',
  body: 'this is the POST body',

  // simple-get accepts all options that node.js `http` accepts
  // See: http://nodejs.org/api/http.html#http_http_request_options_callback
  headers: {
    'user-agent': 'my cool app'
  }
}, function (err, res) {
  if (err) throw err

  // All properties/methods from http.IncomingResponse are available,
  // even if a gunzip/inflate transform stream was returned.
  // See: http://nodejs.org/api/http.html#http_http_incomingmessage
  res.setTimeout(10000)
  console.log(res.headers)

  res.on('data', function (chunk) {
    // `chunk` is the decoded response, after it's been gunzipped or inflated
    // (if applicable)
    console.log('got a chunk of the response: ' + chunk)
  }))

})
```

### JSON

You can serialize/deserialize request and response with JSON:

```js
const get = require('simple-get')

const opts = {
  method: 'POST',
  url: 'http://example.com',
  body: {
    key: 'value'
  },
  json: true
}
get.concat(opts, function (err, res, data) {
  if (err) throw err
  console.log(data.key) // `data` is an object
})
```

### Timeout

You can set a timeout (in milliseconds) on the request with the `timeout` option.
If the request takes longer than `timeout` to complete, then the entire request
will fail with an `Error`.

```js
const get = require('simple-get')

const opts = {
  url: 'http://example.com',
  timeout: 2000 // 2 second timeout
}

get(opts, function (err, res) {})
```

### One Quick Tip

It's a good idea to set the `'user-agent'` header so the provider can more easily
see how their resource is used.

```js
const get = require('simple-get')
const pkg = require('./package.json')

get('http://example.com', {
  headers: {
    'user-agent': `my-module/${pkg.version} (https://github.com/username/my-module)`
  }
})
```

### Proxies

You can use the [`tunnel`](https://github.com/koichik/node-tunnel) module with the
`agent` option to work with proxies:

```js
const get = require('simple-get')
const tunnel = require('tunnel')

const opts = {
  url: 'http://example.com',
  agent: tunnel.httpOverHttp({
    proxy: {
      host: 'localhost'
    }
  })
}

get(opts, function (err, res) {})
```

### Cookies

You can use the [`cookie`](https://github.com/jshttp/cookie) module to include
cookies in a request:

```js
const get = require('simple-get')
const cookie = require('cookie')

const opts = {
  url: 'http://example.com',
  headers: {
    cookie: cookie.serialize('foo', 'bar')
  }
}

get(opts, function (err, res) {})
```

### Form data

You can use the [`form-data`](https://github.com/form-data/form-data) module to
create POST request with form data:

```js
const fs = require('fs')
const get = require('simple-get')
const FormData = require('form-data')
const form = new FormData()

form.append('my_file', fs.createReadStream('/foo/bar.jpg'))

const opts = {
  url: 'http://example.com',
  body: form
}

get.post(opts, function (err, res) {})
```

#### Or, include `application/x-www-form-urlencoded` form data manually:

```js
const get = require('simple-get')

const opts = {
  url: 'http://example.com',
  form: {
    key: 'value'
  }
}
get.post(opts, function (err, res) {})
```

### Specifically disallowing redirects

```js
const get = require('simple-get')

const opts = {
  url: 'http://example.com/will-redirect-elsewhere',
  followRedirects: false
}
// res.statusCode will be 301, no error thrown
get(opts, function (err, res) {})
```

### Basic Auth

```js
const user = 'someuser'
const pass = 'pa$$word'
const encodedAuth = Buffer.from(`${user}:${pass}`).toString('base64')

get('http://example.com', {
  headers: {
    authorization: `Basic ${encodedAuth}`
  }
})
```

### OAuth

You can use the [`oauth-1.0a`](https://github.com/ddo/oauth-1.0a) module to create
a signed OAuth request:

```js
const get = require('simple-get')
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

get(opts, function (err, res) {})
```

### Throttle requests

You can use [limiter](https://github.com/jhurliman/node-rate-limiter) to throttle requests. This is useful when calling an API that is rate limited.

```js
const simpleGet = require('simple-get')
const RateLimiter = require('limiter').RateLimiter
const limiter = new RateLimiter(1, 'second')

const get = (opts, cb) => limiter.removeTokens(1, () => simpleGet(opts, cb))
get.concat = (opts, cb) => limiter.removeTokens(1, () => simpleGet.concat(opts, cb))

var opts = {
  url: 'http://example.com'
}

get.concat(opts, processResult)
get.concat(opts, processResult)

function processResult (err, res, data) {
  if (err) throw err
  console.log(data.toString())
}
```

### Retry on errors

By default, simple-get retries with the following errors.

```js 
const get = require('simple-get');

// default values can be overwritten like this:
get.defaults.retryOnCode = [
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
get.defaults.retryOnError = [
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
get.post(opts, function (err, res) { });

```

### Global options

Change default parameters globally, or create a new instance with specific paramaters (see below)

```js
get.defaults = {
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

### Extend and create new instance

Create a new instance with specific parameters. 

By default, this new instance inherits values of the instance source if options are not overwritten. 
Internaly, only the first level of the option object is merged with `Object.assign(currentInstanceOption, newOptions)`.

Here is an usage example of `beforeRequest` to use [HAProxy as a forward proxy](https://www.haproxy.com/user-spotlight-series/haproxy-as-egress-controller/).

```js
const myInstance = get.extend({
  // WARNING: beforeRequest is also called for each retry/redirect
  beforeRequest: (parsedOpts) => {
    const { hostname, port, protocol, path } = parsedOpts;
    // Replace only on first try (already replaced for second try)
    if (parsedOpts.maxRetry === parsedOpts.remainingRetry) {
      parsedOpts.protocol = 'http:';
      parsedOpts.hostname = '10.0.0.1';
      parsedOpts.port = 80;
      parsedOpts.path = `${protocol}/${hostname}/${port}/${path}`;
    }
    return parsedOpts;
  },
  headers: {
    'Custom-header': 'x-for-proxy'
  }
});

// Then this instance can be used in your app
myInstance.concat() ...

```

### TODO

- [] replace deprecated `url.parse` by `new URL` but new URL is slower than url.parse. Let's see if Node 20 LTS is faster


## license

MIT. Copyright (c) [Feross Aboukhadijeh](http://feross.org).
