const fs = require('fs')
const TOML = require('toml')

require('dotenv').config()

const { getNotionDatabase } = require('./apps/notion.js')
const { updateGoogleSheet } = require('./apps/google-sheets.js')

const {
  COLLECTIONS_PATH = 'collections.toml',
  LAST_UPDATED_PATH = 'last_updated.json'
} = process.env

const time = { lastUpdated: null }

const { collections } = TOML.parse(
  fs.readFileSync(COLLECTIONS_PATH, 'utf-8')
)

try {
  time.lastUpdated = JSON.parse(
    fs.readFileSync(LAST_UPDATED_PATH, 'utf-8')
  )
} catch (error) {
  time.lastUpdated = null
}

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
      lastUpdated
        ? {
            timestamp: 'last_edited_time',
            last_edited_time: { on_or_after: lastUpdated }
          }
        : null
    )

    console.log(`🎲 Data fetched successfully! (${data.length} rows)`)

    time.lastUpdated[notionDatabaseId] = new Date().toISOString()

    const body = JSON.stringify(time.lastUpdated)
    fs.writeFileSync(LAST_UPDATED_PATH, body, 'utf-8')

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
