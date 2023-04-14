const http = require('node:http');
const process = require('node:process');

const Benchmark = require('benchmark');
const axios = require('axios');
const fetch = require('node-fetch');
const simpleGet = require('simple-get');
const got = require('got');
const phin = require('phin');
const request = require('request');
const superagent = require('superagent');
const undici = require('undici');
const rock = require('../index.js');

const PROTOCOL = process.env.BENCHMARK_PROTOCOL || 'http';
const HOST = process.env.BENCHMARK_HOST || 'localhost';
const PORT = process.env.BENCHMARK_PORT ? Number.parseInt(process.env.BENCHMARK_PORT, 10) : 8080;
const PATH = process.env.BENCHMARK_PATH || '/';
const URL = `${PROTOCOL}://${HOST}:${PORT}${PATH}`;

axios.defaults.baseURL = `http://${HOST}`;

const suite = new Benchmark.Suite();

suite.on('start', function () {
  console.log(`Started. URL tested: ${URL}`);
});

suite.add('got | GET |', {
  defer: true,
  fn(defer) {
    got
      .get(URL, { throwHttpErrors: false, retry: 0 })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('got | POST |', {
  defer: true,
  fn(defer) {
    got
      .post(URL, { throwHttpErrors: false })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('rock-req | GET |', {
  defer: true,
  fn(defer) {
    rock({ path: PATH, host: HOST, port: PORT }, () => {
      defer.resolve();
    });
  }
});

suite.add('rock-req | POST |', {
  defer: true,
  fn(defer) {
    rock({ host: HOST, port: PORT, path: PATH, body: '', method: 'POST' }, () => {
      defer.resolve();
    });
  }
});

suite.add('http.request (low-level) | GET |', {
  defer: true,
  fn(defer) {
    http
      .request({ path: PATH, host: HOST, port: PORT }, (res) => {
        res.on('error', (e) => {})
        res.resume().on('close', () => defer.resolve());
      })
      .end();
  }
});

suite.add('http.request (low-level) | POST |', {
  defer: true,
  fn(defer) {
    const req = http.request(
      { host: HOST, port: PORT, path: PATH, method: 'POST' },
      (res) => {
        res.on('error', (e) => {})
        res.resume().on('close', () => defer.resolve());
      }
    );
    req.write('');
    req.on('error',  (e) => {})
    req.end();
  }
});

suite.add('undici (low-level) | GET |', {
  defer: true,
  fn(defer) {
    undici
      .request(URL)
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('undici (low-level) | POST |', {
  defer: true,
  fn(defer) {
    undici
      .request(URL, { method: 'POST' })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('simple-get | GET |', {
  defer: true,
  fn(defer) {
    simpleGet.concat({ path: PATH, host: HOST, port: PORT }, () => {
      defer.resolve();
    });
  }
});

suite.add('simple-get | POST |', {
  defer: true,
  fn(defer) {
    simpleGet.concat({ host: HOST, port: PORT, path: PATH, body: '', method: 'POST' }, () => {
      defer.resolve();
    });
  }
});

suite.add('axios | GET |', {
  defer: true,
  fn(defer) {
    axios
      .get(PATH)
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('axios | POST |', {
  defer: true,
  fn(defer) {
    axios
      .post(PATH)
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('got | GET |', {
  defer: true,
  fn(defer) {
    got
      .get(URL, { throwHttpErrors: false, retry: 0 })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('got | POST |', {
  defer: true,
  fn(defer) {
    got
      .post(URL, { throwHttpErrors: false })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('fetch | GET |', {
  defer: true,
  fn(defer) {
    fetch(URL).then(() => defer.resolve());
  }
});

suite.add('fetch | POST |', {
  defer: true,
  fn(defer) {
    fetch(URL, { method: 'POST' })
      .then(() => defer.resolve())
      .catch(() => defer.resolve());
  }
});

suite.add('request | GET |', {
  defer: true,
  fn(defer) {
    request(URL, () => defer.resolve());
  }
});

suite.add('request | POST |', {
  defer: true,
  fn(defer) {
    request.post({ url: URL }, () => defer.resolve());
  }
});

suite.add('superagent | GET |', {
  defer: true,
  fn(defer) {
    superagent.get(URL).end(() => defer.resolve());
  }
});

suite.add('superagent | POST |', {
  defer: true,
  fn(defer) {
    superagent
      .post(URL)
      .send()
      .end(() => defer.resolve());
  }
});

suite.add('phin | GET |', {
  defer: true,
  fn(defer) {
    phin(URL).then(() => defer.resolve());
  }
});

suite.add('phin | POST |', {
  defer: true,
  fn(defer) {
    phin({ url: URL, method: 'POST' }).then(() => defer.resolve());
  }
});

suite.on('cycle', function (ev) {
  console.log(String(ev.target));
});

suite.on('complete', function () {
  console.log(
    'Fastest is ' + this.filter('fastest').map('name').join(', ') + '\n'
  );
});

suite.run();
