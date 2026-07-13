/**
 * Railway deploy – egyszeri beállítás után: npm run deploy:railway
 *
 * Előfeltételek:
 * 1. npx @railway/cli login
 * 2. npx @railway/cli link  → welcoming-balance → gulumen-webshop
 * 3. Railway Variables: DATABASE_URL (Postgres reference), NEXT_PUBLIC_APP_URL=https://www.gulumen.com
 * 4. Forpsi DNS: www CNAME → Railway networking cél (Settings → Networking)
 */
const { spawnSync } = require('child_process')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log('')
console.log('=== Gulumen Railway deploy (gulumen-webshop service) ===')
console.log('')

if (!process.env.RAILWAY_TOKEN?.trim()) {
  const whoami = spawnSync('npx', ['@railway/cli', 'whoami'], { encoding: 'utf8', shell: true })
  if (whoami.status !== 0) {
    console.error('Nincs Railway bejelentkezés.')
    console.error('Futtasd: npx @railway/cli login')
    console.error('Majd:  npx @railway/cli link  (gulumen-webshop service!)')
    process.exit(1)
  }
}

run('npx', ['@railway/cli', 'up', '--service', 'gulumen-webshop', '-y'])
console.log('')
console.log('Deploy elküldve. Railway → gulumen-webshop → Deployments → View logs')
console.log('Keresd: [start] gulumen-webshop bootstrap v3')
console.log('')
