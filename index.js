const axios = require('axios')
const config = require('./config')
const fs = require('fs')
const moment = require('moment')
require('colors')

/**
 * Do a network call.
 *
 * @param url
 * @returns {Promise<any>}
 */
const doCall = (url) => {
  return new Promise((resolve) => {
    axios.get(url)
      .then(response => {
        resolve(response)
      })
      .catch(error => {
        resolve(error.response)
      })
  })
}

/**
 * Process target object.
 *
 * @param site
 * @param target
 * @returns {Promise<any>}
 */
const processTarget = (site, target) => {
  return new Promise((resolve) => {
    doCall(target.url)
      .then(response => {
        const errors = []
        if (target.statusShouldBe && target.statusShouldBe !== response.status) {
          errors.push({
            url: target.url,
            type: 'INVALID_STATUS_CODE',
            failedAssertion: target.statusShouldBe,
          })
        }
        if (target.see && response.data.toString().indexOf(target.see) < 0) {
          errors.push({
            url: target.url,
            type: 'DID_NOT_SEE',
            failedAssertion: target.see,
          })
        }
        resolve({
          title: site.title,
          targetTitle: target.title,
          url: target.url,
          pass: errors.length < 1,
          errors,
        })
      })
  })
}

/**
 * Handle our output to the terminal.
 *
 * @param results
 */
const render = (results) => {
  console.log('------------------------------------------------------------------------------------------'.white)
  const errorTypeSlugsToHuman = {
    'INVALID_STATUS_CODE': 'Status code did not match what was expected.',
    'DID_NOT_SEE': 'Response body did not include a string that what was expected.',
  }
  config.sites.forEach(site => {
    results.filter(r => r.title === site.title).forEach(callResult => {
      console.log(`${callResult.pass ? '[ OK ]' : '[ ERROR ]'} ${callResult.title} - ${callResult.targetTitle} (${callResult.url})`[callResult.pass ? 'green' : 'red'])
      if (!callResult.pass) {
        console.log(`ERRORS:\n${callResult.errors.map(err => {
          return `${errorTypeSlugsToHuman[err.type]} > ${err.failedAssertion}`
        }).join('\n')}`.bgBlack.cyan)
      }
    })
    console.log('---------------------------------------------'.gray)
  })
}

/**
 * Remove n result objects in our log array.
 *
 * @param arr
 * @returns {*}
 */
const trimLogArray = (arr) => {
  const limit = config.rotateLogsAfterSets
  if (limit < 1) {
    return arr
  }
  arr.splice(0, arr.length - limit)
  return arr
}

/**
 * Write to our log file.
 *
 * @param resultSet
 */
const logToFile = (resultSet) => {
  const logPath = 'output.json'
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '[]')
  }
  let existingArray
  try {
    existingArray = JSON.parse(fs.readFileSync(logPath).toString())
  } catch (e) {
    existingArray = []
  }
  existingArray.push({
    timestamp: moment().toString(),
    resultSet
  })

  existingArray = trimLogArray(existingArray)

  fs.writeFileSync(logPath, JSON.stringify(existingArray))
}

/**
 * Tick!
 */
const tick = () => {
  const callPromises = []

  config.sites.forEach(site => {
    site.targets.forEach(target => {
      callPromises.push(processTarget(site, target))
    })
  })

  Promise.all(callPromises)
    .then(results => {
      logToFile(results)
      render(results)
      setTimeout(tick, (config.intervalInMinutes * 60) * 1000)
    })
}

/**
 * Initialize.
 */
const init = () => {
  tick()
}

init()
