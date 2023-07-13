const fs = require('fs')

require('dotenv').config()

const { getNotionDatabase } = require('./apps/notion.js')
const { updateGoogleSheet } = require('./apps/google-sheets.js')

const FILE_PATH = 'last_updated_time.txt'

const time = {
  current: new Date().toISOString(),
  lastUpdated: null
}

try {
  time.lastUpdated = fs.readFileSync(FILE_PATH, 'utf-8')
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

async function main() {
  for (const key in collections) {
    const {
      notionDatabaseId,
      googleSheetId,
      googleSheetName
    } = collections[key]

    console.log(`===| COLLECTION ${key} |===`)
    console.log(`Fetching data from Notion database (${notionDatabaseId})...`)

    const data = await getNotionDatabase(
      notionDatabaseId,
      time.lastUpdated ? {
        timestamp: 'last_edited_time',
        last_edited_time: { on_or_after: time.lastUpdated }
      } : null
    )
  
    console.log(`Data fetched successfully! (${data.length} rows)`)

    if (!data.length) {
      console.log('Nothing to update.')
      continue
    }

    console.log(`Updating "${googleSheetName}" tab in Google Sheet (${googleSheetId})...`)

    await updateGoogleSheet(googleSheetId, googleSheetName, data)
  
    console.log('Sheet updated successfully!')
  }

  fs.writeFileSync(FILE_PATH, time.current, 'utf-8')
}

main().catch(console.error)
