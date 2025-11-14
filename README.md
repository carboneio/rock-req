
<p align="center">
  <img src="https://raw.githubusercontent.com/carboneio/rock-req/master/doc/rock-req-logo.svg" alt="rock-req logo" height="150"/>
</p>

<h1 align="center" style="border-bottom:none;">Rock-req</h1>

<p align="center">⭐️⭐️ Ensure your HTTP requests always reach their destination as <b>efficiently</b> as possible! ⭐️⭐️</p>
<p align="center">Tested on Mac, Linux, Windows with NodeJS 16, 18, 19, 20, 22, 24, 25</p>

[![npm][npm-image]][npm-url]  [![ci][ci-image]][ci-url]  [![javascript style guide][standard-image]][standard-url]

[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com
[npm-image]: https://img.shields.io/npm/v/rock-req.svg
[npm-url]: https://npmjs.org/package/rock-req
[ci-url]: https://github.com/carboneio/rock-req/actions
[ci-image]: https://img.shields.io/github/actions/workflow/status/carboneio/rock-req/ci.yml?branch=master

## 🔥 Why?

In most existing libraries (2025):

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

Stop using "slow-by-default" and "false-light" HTTP request libraries!

**2025-11-14 on MacBook Pro M4 Max with all dependencies updated on this date**


| Library      | NodeJS 22      | NodeJS 24     | NodeJS 25       | Bun v1.3.2     | Size deps inc (2025/2023)  |
|--------------|---------------:|---------------:|---------------:|---------------:|---------------------------:|
| rock-req 🙋‍♂️  | 26842 req/s    | 26782 req/s    | 26179 req/s    | 21229 req/s    | 152 LOC (+5%)               |
| simple-get   | 26532 req/s    | 26802 req/s    | 25954 req/s    | 21187 req/s    | 317 LOC (+0%)              |
| axios        |  4110 req/s    |  3999 req/s    |  3996 req/s    | 14788 req/s    | 19883 LOC (+42%)           |
| got          | 14786 req/s    | 15234 req/s    | 15149 req/s    | 15287 req/s    | 16904 LOC (+83%)           |
| fetch        | 15676 req/s    | 16252 req/s    | 15784 req/s    | 27675 req/s    | 54211 LOC (+306%)          |
| request      | 17102 req/s    | 14586 req/s    | 14346 req/s    | 18202 req/s    | 58057 LOC (+24%)           |
| superagent   |  3862 req/s    |  3979 req/s    |  3889 req/s    | 19271 req/s    | 31913 LOC (+98%)           |
| phin         | 15549 req/s    | 14160 req/s    | 13915 req/s    | 15430 req/s    | 20064 LOC (+5960%)         |
| _undici_*    | 32480 req/s    | 33272 req/s    | 32738 req/s    | 25961 req/s    | 23235 LOC (+43%)           |


**2023-04-19 on Macbook Pro M1 Max with all dependencies updated on this date**


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


> Since Node.js 20, HTTP keep-alive is activated by default, just like in `rock-req`.  This improves the overall performance of all frameworks.

> `undici` is a low-level API and a faster alternative to the native Node.js HTTP module. It represents the performance ceiling for Node.js.

> `rock-req` uses only the native Node.js HTTP module and provides many high-level features — far more than `phin` and `simple-get` — with fewer lines of code.

> Interestingly, the differences are less visible on Bun.sh.

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
    <img src="https://carbone.io/img/carbone-logo.svg" alt="Carbone.io logo" height="60"/>
  </a>
</p>


Thank you [Feross Aboukhadijeh](https://github.com/feross), creator of `simple-get` 
