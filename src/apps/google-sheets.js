const Bottleneck = require('bottleneck')
const { google } = require('googleapis')

// Google Sheets API Rate Limiting
// https://developers.google.com/sheets/api/limits
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 334
})

const sheets = google.sheets('v4')

async function authorize () {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
  )

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  google.options({ auth: await auth.getClient() })
}

async function getSheetId (spreadsheetId, sheetName) {
  const { data } = await limiter.schedule(() => sheets.spreadsheets.get({
    spreadsheetId
  }))

  return data.sheets.find(
    sheet => sheet.properties.title === sheetName
  ).properties.sheetId
}

function getUserEnteredValue (value) {
  const userEnteredValue = {}

  if (value === null || value === undefined) {
    userEnteredValue.stringValue = ''
  } else {
    typeof value === 'number'
      ? userEnteredValue.numberValue = value
      : userEnteredValue.stringValue = String(value)
  }

  return { userEnteredValue }
}

async function updateGoogleSheet (spreadsheetId, sheetName, data) {
  await authorize()

  const sheetId = await getSheetId(spreadsheetId, sheetName)

  const { data: { values: rows = [] } } = await limiter.schedule(() =>
    sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName })
  )

  const existingHeader = rows[0] || []
  const existingRows = rows.slice(1)

  const idToIndexMap = new Map(
    existingRows.map((row, index) => [row[0], index + 2])
  )

  const requests = []
  const newHeader = Object.keys(data[0])

  if (JSON.stringify(newHeader) !== JSON.stringify(existingHeader)) {
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        fields: '*',
        rows: [{ values: newHeader.map(getUserEnteredValue) }]
      }
    })
  }

  const toDelete = []

  for (const dataRow of data) {
    const id = dataRow[newHeader[0]]

    if (idToIndexMap.has(id)) {
      toDelete.push(idToIndexMap.get(id))
      idToIndexMap.delete(id)
    }
  }

  toDelete.sort((a, b) => b - a)

  for (const index of toDelete) {
    requests.push({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: index - 1,
          endIndex: index
        }
      }
    })
  }

  for (const dataRow of data) {
    requests.push({
      appendCells: {
        sheetId,
        fields: '*',
        rows: [{
          values: newHeader.map(key => getUserEnteredValue(dataRow[key]))
        }]
      }
    })
  }

  await limiter.schedule(() =>
    sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } })
  )
}

module.exports = {
  updateGoogleSheet
}
