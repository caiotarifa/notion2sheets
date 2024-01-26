const fs = require('fs')

require('dotenv').config()

const { getNotionDatabase } = require('./apps/notion.js')
const { updateGoogleSheet } = require('./apps/google-sheets.js')

const FILE_PATH = 'last_updated_time.json'

const time = {
  current: {},
  lastUpdated: null
}

try {
  const body = fs.readFileSync(FILE_PATH, 'utf-8')
  time.lastUpdated = JSON.parse(body)
} catch (error) {
  time.lastUpdated = null
}

const collections = [
  {
    notionDatabaseId: 'your-notion-database-id',
    googleSheetId: 'your-google-sheet-id',
    googleSheetName: 'your-google-sheet-name'
  }
]

async function main () {
  for (const key in collections) {
    const {
      notionDatabaseId,
      googleSheetId,
      googleSheetName
    } = collections[key]

    console.log(`===| COLLECTION | ${googleSheetName.toUpperCase()} |===`)
    console.log(`🕐 Fetching data from Notion database (${notionDatabaseId})...`)

    const lastUpdated = time.lastUpdated ? time.lastUpdated[notionDatabaseId] : null

    const data = await getNotionDatabase(
      notionDatabaseId,
      lastUpdated ? {
        timestamp: 'last_edited_time',
        last_edited_time: { on_or_after: lastUpdated }
      } : null
    )
  
    console.log(`🎲 Data fetched successfully! (${data.length} rows)`)

    time.current[notionDatabaseId] = new Date().toISOString()

    const body = JSON.stringify(time.current)
    fs.writeFileSync(FILE_PATH, body, 'utf-8')

    if (!data.length) {
      console.log('🟢 Nothing to update.\n')
      continue
    }

    console.log(`🕐 Updating "${googleSheetName}" tab in Google Sheet (${googleSheetId})...`)

    try {
      await updateGoogleSheet(googleSheetId, googleSheetName, data)
      console.log('🟢 Sheet updated successfully!\n')
    } catch (error) {
      console.error('🔴 Error updating Google Sheet.\n', error)
    }
  }
}

main().catch(console.error)
