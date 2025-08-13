import { readFileSync } from 'fs'
import { resolve } from 'path'

export const httpsOptions = {
  key: readFileSync(
    resolve(__dirname, '..', '..', '..', 'api.dvlin.com_nginx/api.dvlin.com.key')
  ),
  cert: readFileSync(
    resolve(__dirname, '..', '..', '..', 'api.dvlin.com_nginx/api.dvlin.com.crt')
  ),
}
