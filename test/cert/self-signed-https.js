const https = require('https')
const fs = require('fs')
const path = require('path')

// Read 2048-bit self-signed certificate and key from disk
function getSelfSignedCert () {
  const keyPath = path.join(__dirname, 'key.pem')
  const certPath = path.join(__dirname, 'cert.pem')

  const key = fs.readFileSync(keyPath, 'utf8')
  const cert = fs.readFileSync(certPath, 'utf8')

  return { key, cert }
}

module.exports = function (app) {
  const { key, cert } = getSelfSignedCert()
  return https.createServer({
    key: key,
    cert: cert,
    requestCert: false,
    rejectUnauthorized: false
  }, app)
}

