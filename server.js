const http = require('http')
const {createServer} = http
const { parse } = require('url')
const next = require('next')
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const { BTCMD_GetStatus } = require('./lib/cgiByteCodeMap')
const { config } = require('./config')
const sanityClient = require('@sanity/client')

const client = sanityClient({
  projectId: config.projectId,
  dataset: config.dataset,
  token: config.token,
  useCdn: false
})

const code = 'a'

const lastLogQuery = '*[_type == "brewLog"] | order(_createdAt asc) { _id, title }[0]'

async function run() {

  const lastLog = await client.fetch(lastLogQuery).then(log => {
    console.log('# Last log')
    console.log('title', log.title)
    console.log('_id', log._id)
    return log
  })
  
  const sendLogItem = (id, logItem) => {
    console.log('Send logitem', logItem['responseCode'], id)
    const newLogItem = {}
    Object.keys(logItem).forEach(key => {
      // Convert to number
      if (
        key !== 'responseCode'
        && key !== '_type'
        && key !== '_key'
        && key !== 'timestamp'
        && key !== 'Program1_Name'
        && key !== 'Program2_Name'
        && key !== 'Program3_Name'
        && key !== 'Mash_Zone_Active_Program_Step'
        && key !== 'Mash_Zone_Active_Program_Recipe'
        && key !== 'Boil_Zone_Active_Program_Step'
        && key !== 'Boil_Zone_Active_Program_Recipe'
      ) {
        newLogItem[key] = Number(logItem[key])
      } else {
        newLogItem[key] = logItem[key]
      }
    })

    // Send data to sanity
    client
      .patch(id)
      .setIfMissing({log: []})
      .append('log', [newLogItem])
      .commit()
      .then(updatedLog => {
          console.log('updatedLog')
        })
      .catch(err => {
        console.error('Sanity client: Oh no, the update failed: ', err.message)
      })
  }
  
  setInterval(() => {
    // Create logitem
    const logItem = {
      _type: 'logItem',
      _key: new Date().getTime(),
      timestamp: new Date()
    }
  
    // testing
    if (config.mock) {
      console.log('mock')
      BTCMD_GetStatus().rspParams.map((param, i) => {
        logItem[param] = config.mock[i]
      })
      sendLogItem(lastLog._id, logItem)
      return
    }
  
    http.get(
      `${config.url}?${code}`, (resp) => {
        let data = ''
        resp.on('data', (chunk) => {
          data += chunk;
        })
    
        resp.on('end', () => {
          // Map the brewtroller values
          BTCMD_GetStatus().rspParams.map((param, i) => {
            logItem[param] = JSON.parse(data)[i]
          })

          if (logItem['responseCode'] === code) {
            sendLogItem(lastLog._id, logItem)
            
          } else {
            console.log('Got empty status from brewtroller', data)
          }
        })
    
      }
    ).on("error", (err) => {
      console.log("Error connecting to Brewtroller " + err.message)
    })  
  }, config.intervalSeconds * 1000 || 10000)
}

run()


// app.prepare().then(() => {
//   createServer((req, res) => {
//     // Be sure to pass `true` as the second argument to `url.parse`.
//     // This tells it to parse the query portion of the URL.
//     const parsedUrl = parse(req.url, true)
//     const { pathname, query } = parsedUrl

//     if (pathname === '/a') {
//       app.render(req, res, '/b', query)
//     } else if (pathname === '/b') {
//       app.render(req, res, '/a', query)
//     } else {
//       handle(req, res, parsedUrl)
//     }
//   }).listen(3000, err => {
//     if (err) throw err
//     console.log('> Ready on http://localhost:3000')
//   })
// })