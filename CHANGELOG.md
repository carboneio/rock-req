# Rock-req

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
