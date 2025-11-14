
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
- **Ultra-fast (> 20k ops)**
- Keep Alive by default (3000ms)
- Composable
- Timeouts
- Promises interface
- HTTPS / HTTP
- Composes well with npm packages for features like cookies, proxies, form data, & OAuth
- Keep 98% of the `simple-get` API (fork source)

When the callback is called, the request is 100% finished, even with streams.


## 🚀 Benchmark Rock-req vs got, axios, node-fetch, phin, simple-get, superagent, ...

Stop using "slow-by-default" and "false-light" HTTP request libraries!

**2025-11-14 on MacBook Pro M4 Max with all dependencies updated on this date**


| Library      | NodeJS 22 | NodeJS 24   | NodeJS 25  | Bun v1.3.2 | LOC 2025/2023 |
|--------------|-----------:|---------- --:|---------:|-----------:|----------------:|
| rock-req 🙋‍♂️  | 26842 ops  | 26782 ops  | 26179 ops  | 21229 ops  | 152 (+5%)      |
| simple-get   | 26532 ops  | 26802 ops  | 25954 ops  | 21187 ops  | 317 (+0%)      |
| axios        |  4110 ops  |  3999 ops  |  3996 ops  | 14788 ops  | 19883 (+42%)   |
| got          | 14786 ops  | 15234 ops  | 15149 ops  | 15287 ops  | 16904 (+83%)   |
| fetch        | 15676 ops  | 16252 ops  | 15784 ops  | 27675 ops  | 54211 (+306%)  |
| request      | 17102 ops  | 14586 ops  | 14346 ops  | 18202 ops  | 58057 (+24%)   |
| superagent   |  3862 ops  |  3979 ops  |  3889 ops  | 19271 ops  | 31913 (+98%)   |
| phin         | 15549 ops  | 14160 ops  | 13915 ops  | 15430 ops  | 20064 (+5960%) |
| _undici_*    | 32480 ops  | 33272 ops  | 32738 ops  | 25961 ops  | 23235 (+43%)   |


**2023-04-19 on Macbook Pro M1 Max with all dependencies updated on this date**


| Library      | NodeJS 16     | NodeJS 18     | NodeJS 20*     | Size deps inc. |
| ------------ |--------------:|--------------:| --------------:| --------------:|
| rock-req 🙋‍♂️  | 22816 ops     | 21797 ops     |  21964 ops     |  144 LOC       |
| simple-get   |  2937 ops     |  3260 ops     |  21258 ops     |   317 LOC      |
| axios        |  5090 ops     |  4910 ops     |   3196 ops     | 13983 LOC      |
| got          |  2163 ops     |  1762 ops     |   9961 ops     |  9227 LOC      |
| fetch        |  2101 ops     |  2102 ops     |   2020 ops     | 13334 LOC      |
| request      |  2249 ops     |  1869 ops     |  15815 ops     | 46572 LOC      |
| superagent   |  2776 ops     |  2100 ops     |   2895 ops     | 16109 LOC      |
| phin         |  3178 ops     |  1164 ops     |  21299 ops     |   331 LOC      |
| _undici_*    | 24095 ops     | 24378 ops     |  24191 ops     | 16225 LOC      |


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
