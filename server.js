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

const lastLogQuery = '*[_type == "brewLog"] | order(_createdAt asc) { _id, title }[0]'

const lastLog = client.fetch(lastLogQuery).then(log => {
  console.log('# Last log')
  console.log('title', log.title)
  console.log('_id', log._id)
  return log
})

setInterval(() => {
  http.get(
    `${url}?a`, (resp) => {
      let data = ''
      resp.on('data', (chunk) => {
        data += chunk;
      })
  
      resp.on('end', () => {
        // Create logitem
        const logItem = {
          _type: 'logItem',
          _key: new Date().getTime(),
          timestamp: new Date()
        }

        // Map the brewtroller values
        BTCMD_GetStatus().rspParams.map((param, i) => {
          logItem[param] = JSON.parse(data)[i]
        })

        // Send data to sanity
        client
          .patch(lastLog._id)
          .setIfMissing({log: []})
          .append('log', [logItem])
          .commit()
          .then(updatedLog => {
              console.log('responseCode', updatedLog.responseCode)
            })
          .catch(err => {
            console.error('Sanity client: Oh no, the update failed: ', err.message)
          })
      })
  
    }
  ).on("error", (err) => {
    console.log("Error connecting to Brewtroller " + err.message)
  })  
}, config.intervalSeconds * 10000 || 10000)


app.prepare().then(() => {
  createServer((req, res) => {
    // Be sure to pass `true` as the second argument to `url.parse`.
    // This tells it to parse the query portion of the URL.
    const parsedUrl = parse(req.url, true)
    const { pathname, query } = parsedUrl

    if (pathname === '/a') {
      app.render(req, res, '/b', query)
    } else if (pathname === '/b') {
      app.render(req, res, '/a', query)
    } else {
      handle(req, res, parsedUrl)
    }
  }).listen(3000, err => {
    if (err) throw err
    console.log('> Ready on http://localhost:3000')
  })
})