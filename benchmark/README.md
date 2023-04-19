Benchmark
=========

How to run:

```js
  cd benchmark
  npm i
  node server.js
  node run.js
```

# Benchmark

| Library      | NodeJS 16     | NodeJS 18     | NodeJS 20      | Size deps inc. |
| ------------ |--------------:|--------------:| --------------:| --------------:|
| rock-req 🙋‍♂️  | 22816 req/s   | 21797 req/s   |  21964 req/s   |  144 LOC       |
| simple-get   |  2937 req/s   |  3260 req/s   |  21258 req/s   |   317 LOC      |
| axios        |  5090 req/s   |  4910 req/s   |   3196 req/s   | 13983 LOC      |
| got          |  2163 req/s   |  1762 req/s   |   9961 req/s   |  9227 LOC      |
| fetch        |  2101 req/s   |  2102 req/s   |   2020 req/s   | 13334 LOC      |
| request      |  2249 req/s   |  1869 req/s   |  15815 req/s   | 46572 LOC      |
| superagent   |  2776 req/s   |  2100 req/s   |   2895 req/s   | 16109 LOC      |
| phin         |  3178 req/s   |  1164 req/s   |  21299 req/s   |   331 LOC      |
| undici*      | 24095 req/s   | 24378 req/s   |  24191 req/s   | 16225 LOC      |

