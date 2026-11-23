// Type test of an ESM consumer (module nodenext), checked by `npm run test:types` (never executed)
import rock from 'rock-req'
import type { Options } from 'rock-req'

const opts: Options = { url: 'http://example.com', maxRetry: 0 }
const { response, data } = await rock.promises.getJSON<{ id: number }>(opts)
const id: number = data.id
const status: number | undefined = response.statusCode
rock.get('http://example.com', (err, res, buffer: Buffer) => [err, res, buffer])
export { id, status }
