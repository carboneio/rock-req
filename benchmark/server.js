const http = require('http')
const cluster = require('cluster')
const NB_SERVER = 3
const PORT = 8080

if (cluster.isPrimary) {
  console.log(`Server primary ${process.pid} is listening on port ${PORT}`)
  for (let i = 0; i < NB_SERVER; i++) {
    cluster.fork()
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`)
  })
} else {
  http.createServer((req, res) => {
    res.writeHead(200)
    res.end()
  }).listen(PORT)
  console.log(`Worker ${process.pid} started`)
}
