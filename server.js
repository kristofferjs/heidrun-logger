const http = require('http')
const {parse} = require('url')
const express = require('express')
const app = express()

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

let logging = true

const lastLogQuery = '*[_type == "brewLog"] | order(_createdAt desc) { _id, title }[0]'

process.argv.forEach(function (val, index, array) {
  if (val == 'no-log') {
    logging = false
  }
});

const subscription = client.listen('*[_type == "command" && !(_id in path ("drafts.**"))]')
  .subscribe(command => {
    console.log('response', command)
    runRemoteCommand(command)
  })


function returnResultRemoteCommand(command, result) {
  console.log('sending result', result)
  client
    .patch(command.result.id)
    .setIfMissing('result', result)
}

function runRemoteCommand(command = {}) {
  const btnicCommand = command.result && command.result.command

  console.log('command:', btnicCommand)

  if (!btnicCommand) {
    console.error('No command')
    return
  }

  http.get(
    `${config.url}?${btnicCommand}`, resp => {
      let data = ''
      console.log('resp', resp)
      resp.on('data', chunk => {
        data += chunk
      })
      resp.on('end', () => {
        console.log('got data', data)
        returnResultRemoteCommand(command, data)
      })
    }
  ).on('error', err => {
    console.error(`Error connecting to Brewtroller ${err.message}`)
  })
}


async function startLog() {
  const lastLog = await client.fetch(lastLogQuery).then(log => {
    console.log('# Start logging')
    console.log('title', log.title)
    console.log('_id', log._id)
    return log
  })
  
  const sendLogItem = (id, logItem) => {
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
          console.log(`Updated: HLT: ${newLogItem['HLT_Temperature']} MASH: ${newLogItem['Mash_Temperature']} BOIL: ${newLogItem['Kettle_Temperature']}`)
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
  
    // Testing with mock
    if (config.mock) {
      console.log('mock')
      BTCMD_GetStatus().rspParams.map((param, i) => {
        logItem[param] = config.mock[i]
      })
      logItem.HLT_Temperature = Math.random() * 10000
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

if (logging) {
  startLog()
} else {
  console.log('Logging disabled')
}


app.get('/', function (req, res) {
  res.send('Heidrun says hello 🍺')
})

// Proxy to the brewtroller
app.get('/api/btnic', function (req, res) {

  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")

  const params = req._parsedUrl.query
  console.log('parsedUrl.query', req._parsedUrl.query)

  http.get(
    `${config.url}?${params}`, resp => {
      let data = ''
      resp.on('data', chunk => {
        data += chunk
      })

      resp.on('end', () => {
        res.send(`OK ${data}`)
        return JSON.parse(data)
      })

    }
  ).on('error', err => {
    console.error(`Error connecting to Brewtroller ${err.message}`)
  })
})

app.listen(3000, () => console.log('Staring Heidrun Server: port 3000!'))
