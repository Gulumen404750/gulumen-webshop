/**
 * next build előtt – NEXT_PUBLIC_APP_URL localhost javítás Railway productionben.
 */
const { ensureProductionUrls } = require('./ensure-production-url.cjs')

ensureProductionUrls('build')
