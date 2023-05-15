
<p align="center">
  <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/rock-req-logo.svg" alt="rock-req logo" height="150"/>
</p>

<h1 align="center" style="border-bottom:none;">Rock-req</h1>

<p align="center">⭐️⭐️ Ensure your HTTP requests always reach their destination as <b>efficiently</b> as possible! ⭐️⭐️</p>
<p align="center">Tested on Mac, Linux, Windows with NodeJS 16, 18, 19, 20</p>

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


| Library      | NodeJS 16     | NodeJS 18     | NodeJS 20*     | Size deps inc. |
| ------------ |--------------:|--------------:| --------------:| --------------:|
| rock-req 🙋‍♂️  | 22816 req/s   | 21797 req/s   |  21964 req/s   |  144 LOC       |
| simple-get   |  2937 req/s   |  3260 req/s   |  21258 req/s   |   317 LOC      |
| axios        |  5090 req/s   |  4910 req/s   |   3196 req/s   | 13983 LOC      |
| got          |  2163 req/s   |  1762 req/s   |   9961 req/s   |  9227 LOC      |
| fetch        |  2101 req/s   |  2102 req/s   |   2020 req/s   | 13334 LOC      |
| request      |  2249 req/s   |  1869 req/s   |  15815 req/s   | 46572 LOC      |
| superagent   |  2776 req/s   |  2100 req/s   |   2895 req/s   | 16109 LOC      |
| phin         |  3178 req/s   |  1164 req/s   |  21299 req/s   |   331 LOC      |
| _undici_*    | 24095 req/s   | 24378 req/s   |  24191 req/s   | 16225 LOC      |


> NodeJS 20 activates HTTP keep-alive by default, like `rock-req`

> `undici` is a low-level API, faster alternative to the native NodeJS http module. It is the glass ceiling limit for NodeJS.

> `rock-req` uses only the native NodeJS http module and provides many high-level features, a lot more than `phin` and `simple-get` with fewer lines of code.

> Tested on Macbook Pro M1 Max


## Install

```bash
  npm install rock-req
```

## Documentation

[The full documentation is here](doc/api.md) to reduce Node package file size.

## Supporters

This packaged in maintained by Carbone:

<p>
  <a href="https://carbone.io" alt="Carbone.io - Efficient PDF / DOCX / XLSX / CSV / HTML / XML generator with templates and JSON">
    <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/carbone-logo.svg" alt="Carbone.io logo" height="60"/>
  </a>
</p>


Thank you [Feross Aboukhadijeh](https://github.com/feross), creator of `simple-get` 
