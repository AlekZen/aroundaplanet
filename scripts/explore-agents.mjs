// Exploratory script: understand what "agents" exist in Odoo
// Checks crm.team, sale.order.team_id distinct, sale.order.user_id distinct
import xmlrpc from 'xmlrpc'

const URL = 'https://aroundaplanet.odoo.com'
const DB = 'aroundaplanet'
const USER = 'noelnumata@gmail.com'
const KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => err ? reject(err) : resolve(val))
  })
}

async function main() {
  const common = xmlrpc.createSecureClient({ url: `${URL}/xmlrpc/2/common` })
  const uid = await call(common, 'authenticate', [DB, USER, KEY, {}])
  console.log('UID:', uid)

  const obj = xmlrpc.createSecureClient({ url: `${URL}/xmlrpc/2/object` })
  const exec = (model, method, args, kwargs = {}) =>
    call(obj, 'execute_kw', [DB, uid, KEY, model, method, args, kwargs])

  // 1. ALL crm.teams
  console.log('\n=== ALL CRM TEAMS ===')
  const teams = await exec('crm.team', 'search_read', [[]], {
    fields: ['name', 'member_ids', 'active', 'user_id'],
    limit: 100
  })
  console.log(`Total teams: ${teams.length}`)
  for (const t of teams) {
    console.log(`  ID=${t.id} name="${t.name}" active=${t.active} members=${JSON.stringify(t.member_ids)} leader=${JSON.stringify(t.user_id)}`)
  }

  // 2. Distinct team_ids from sale.order (read_group)
  console.log('\n=== DISTINCT TEAM_IDs IN SALE.ORDER (read_group) ===')
  const teamGroups = await exec('sale.order', 'read_group', [
    [['state', 'in', ['sale', 'done']]]
  ], {
    fields: ['team_id'],
    groupby: ['team_id'],
    lazy: true
  })
  console.log(`Distinct teams with orders: ${teamGroups.length}`)
  for (const g of teamGroups) {
    console.log(`  team_id=${JSON.stringify(g.team_id)} count=${g.team_id_count}`)
  }

  // 3. Distinct user_ids from sale.order (read_group)
  console.log('\n=== DISTINCT USER_IDs IN SALE.ORDER (read_group) ===')
  const userGroups = await exec('sale.order', 'read_group', [
    [['state', 'in', ['sale', 'done']]]
  ], {
    fields: ['user_id'],
    groupby: ['user_id'],
    lazy: true
  })
  console.log(`Distinct users with orders: ${userGroups.length}`)
  for (const g of userGroups) {
    console.log(`  user_id=${JSON.stringify(g.user_id)} count=${g.user_id_count}`)
  }

  // 4. Fetch res.users for those user_ids
  const userIds = userGroups.map(g => g.user_id ? g.user_id[0] : null).filter(Boolean)
  if (userIds.length > 0) {
    console.log('\n=== RES.USERS DETAILS FOR SELLERS ===')
    const users = await exec('res.users', 'read', [userIds], {
      fields: ['name', 'login', 'active', 'partner_id']
    })
    for (const u of users) {
      console.log(`  ID=${u.id} name="${u.name}" login="${u.login}" active=${u.active}`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
