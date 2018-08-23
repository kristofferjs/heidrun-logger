// This file doesn't go through babel or webpack transformation.
// Make sure the syntax and sources this file requires are compatible with the current node version you are running
// See https://github.com/zeit/next.js/issues/1245 for discussions on Universal Webpack or universal Babel
// const { createServer } = require('http')
// const { parse } = require('url')
// const next = require('next')
const {BTCMD_GetStatus} = require('./lib/cgiByteCodeMap')
const sanityClient = require('@sanity/client')
const client = sanityClient({
  projectId: 'k7qicdza',
  dataset: 'production',
  token: 'skI4Y6IKYwYjImRNLgxg7NXGLY4Z5sZStLDaElNzjsj8g2V1izFT31WlbnavehMs4BWomY3IqCaGVOFMAptuSQdSw5Iaa0QY9ztridIUmSw4RKJIigJmV4SdyKfnwBK7KBmNmDAdSOrYsNLnsUatGdX4QvOZnw5OHB4TnyfduqH1QJ8N6XnZ', // or leave blank to be anonymous user
})

// const dev = process.env.NODE_ENV !== 'production'
// const app = next({ dev })
// const handle = app.getRequestHandler()

const url = 'http://10.0.1.37/btnic.cgi?a'

const testData = ["a","0","0","44081152","252","8000","2137","100","0","0","0","0","2068","0","0","0","0","8000","2125","100","0","0","0","4294934528","4294934528","4294934528","2000","4294934528","4294934528","0","0","0","0","0","255","BENGLER ALE        ","0","255","","255"]

let currentLogId = 'aac36986-6322-487f-a245-e53a42179e07'

// const brewLog = {
//   _type: 'brewLog',
//   title: 'test',
// }
 
// client.create(brewLog).then(res => {
//   currentId = res._id
//   console.log(`Brew was created ${res._id}`)
// })

//  setInterval(() => {
  // const logItem = {
  //   "_type": 'logItem',
  //   "_key": "timestamp": new Date().getTime(),
  //   "timestamp": new Date().getTime()
  // }

  const log = []

  for (let index = 0; index < 180; index++) {
    const logItem = {
      "_type": 'logItem',
      "_key": new Date().getTime(),
      "timestamp": new Date(new Date().getTime() + (10000 * index + 1)),
    }
    BTCMD_GetStatus().rspParams.map((param, i) => {
      logItem[param] = testData[i]
      logItem.Mash_Temperature = Math.random() * 10000
      logItem.HLT_Temperature = Math.random() * 10000
      logItem.Kettle_Temperature = Math.random() * 10000
    })
    log.push(logItem)
  }

  // console.log(log)
  

  client
     .patch(currentLogId)
     .append('log', log)
     .commit()
     .then(updatedLog => {
        console.log('Hurray, the brew log is updated! New document:')
        console.log('log', updatedLog)
      })
     .catch(err => {
       console.error('Oh no, the update failed: ', err.message)
     })
  
// }, 5000)


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