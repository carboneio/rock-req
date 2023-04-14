# Rock-req

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
