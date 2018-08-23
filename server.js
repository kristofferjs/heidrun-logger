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
  token: config.token
})

//const mock = ["a","0","0","44081152","252","8000","2187","100","0","0","0","0","2100","0","0","0","0","8000","2200","100","0","0","0","4294934528","4294934528","4294934528","2000","4294934528","4294934528","0","0","0","0","0","255","BENGLER ALE        ","0","255","","255"]
const lastLogQuery = '*[_type == "brewLog"] | order(_createdAt asc) { _id, title }[0]'

async function run() {

  const lastLog = await client.fetch(lastLogQuery).then(log => {
    console.log('# Last log')
    console.log('title', log.title)
    console.log('_id', log._id)
    return log
  })
  
  
  const sendLogItem = (id, logItem) => {
    Object.keys(logItem).map(key => {
      if (
        key != 'responseCode'
        || key != 'Program1_Name'
        || key != 'Program2_Name'
        || key != 'Program3_Name'
      ) {
        logItem[key] = Number(logItem[key])  
      }
    })
    console.log('Send logitem',  logItem['responseCode'])

    // Send data to sanity
    client
      .patch(id)
      .setIfMissing({log: []})
      .append('log', [logItem])
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
        logItem[param] = mock[i]
      })
      sendLogItem(lastLog._id, logItem)
      return
    }
  
    http.get(
      `${config.url}?a`, (resp) => {
        let data = ''
        resp.on('data', (chunk) => {
          data += chunk;
        })
    
        resp.on('end', () => {
          // Map the brewtroller values
          BTCMD_GetStatus().rspParams.map((param, i) => {
            logItem[param] = JSON.parse(data)[i]
          })

          if (logItem['responseCode']) {
            console.log('Got empty status from brewtroller')
          } else {
            sendLogItem(lastLog._id, logItem)
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