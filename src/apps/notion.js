const util = require('util')

const Bottleneck = require('bottleneck')
const { Client } = require('@notionhq/client')

const { formatBoolean, formatDate, formatNumber } = require('../utils')

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 334 // ~3 allowed requests per second
})

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const pageCache = {}
const userCache = {}

function cacheUser (user) {
  if (user && !userCache[user.id]) {
    userCache[user.id] = user
  }
}

async function getPage (pageId) {
  if (!pageCache[pageId]) {
    pageCache[pageId] = await limiter.schedule(() =>
      notion.pages.retrieve({ page_id: pageId })
    )
  }

  return pageCache[pageId]
}

async function getUser (userId) {
  if (!userCache[userId]) {
    userCache[userId] = await limiter.schedule(async () => {
      try {
        const user = await notion.users.retrieve({ user_id: userId })
        return user
      } catch (error) {
        return { name: '' }
      }
    })
  }

  return userCache[userId]
}

async function extractProperty (property) {
  // https://developers.notion.com/reference/property-object
  // https://developers.notion.com/reference/page-property-values
  switch (property.type) {
    // Checkbox
    case 'checkbox':
      return formatBoolean(property.checkbox)

    // Created By
    case 'created_by':
      const { created_by: createdBy } = property

      cacheUser(createdBy)
      return createdBy.name ?? ''

    // Created Time
    case 'created_time':
      return formatDate(property.created_time ?? '')

    // Date
    case 'date':
      const { start, end } = property.date || {}
      return [formatDate(start), formatDate(end)].filter(Boolean).join(' - ')

    // Email
    case 'email':
      return property.email

    // Files
    // TODO: Implement files

    // Formula
    case 'formula':
      const { formula } = property

      switch (formula.type) {
        case 'boolean':
          return formatBoolean(formula.boolean)

        case 'date':
          return formatDate(formula.date)

        case 'number':
          return formatNumber(formula.number)

        default:
          return formula[formula.type]
      }

    // Last Edited Time
    case 'last_edited_time':
      return formatDate(property.last_edited_time)
    
    // Last Edited By
    case 'last_edited_by':
      const { last_edited_by: lastEditedBy } = property

      cacheUser(lastEditedBy)
      return lastEditedBy.name ?? ''
    
    // Multi Select
    case 'multi_select':
      return property.multi_select.map(select => select?.name).join('\n')

    // Number
    case 'number':
      return formatNumber(property.number)

    // People
    case 'people':
      const people = []

      for (const person of property.people) {
        cacheUser(person)
        people.push(person.name)
      }

      return people.join('\n')

    // Phone Number
    case 'phone_number':
      return property.phone_number

    // Relation
    case 'relation':
      if (property.relation.length) {
        const relations = []

        for (const relation of property.relation) {
          // TODO: Implement has_more
          const { properties } = await getPage(relation.id)
    
          for (const key in properties) {
            if (properties[key].type === 'title') {
              const title = await extractProperty(properties[key])
              relations.push(title)
              break
            }
          }
        }
    
        return relations.join('\n')
      }

      return ''

    // Rich Text
    case 'rich_text':
      return property.rich_text.map(text => text.plain_text).join('\n')

    // Rollup
    case 'rollup':
      // TODO: Implement rollup functions and others types
      const { rollup } = property
      
      if (rollup.type === 'array') {
        const rollups = []

        for (const item of rollup.array) {
          rollups.push(await extractProperty(item))
        }

        return rollups.join('\n')
      }

      return (await extractProperty(rollup))

    // Selects
    case 'select':
      return property.select?.name || ''

    // Status
    case 'status':
      return property.status?.name || ''

    // Title
    case 'title':
      const title = property.title[0]
      return title?.text?.content || title?.plain_text || ''

    // Unique ID
    case 'unique_id':
      const { prefix, number } = property.unique_id
      return [prefix, number].filter(Boolean).join('-')

    // URL
    case 'url':
      return property.url

    // Other
    default:
      return ''
  }
}

async function getNotionDatabase (databaseId, filter) {
  const loop = {
    hasMore: true,
    results: []
  }

  while (loop.hasMore) {
    const response = await limiter.schedule(() => notion.databases.query({
      database_id: databaseId,
      start_cursor: loop.cursor,
      page_size: 100,
      filter: filter || undefined
    }))

    if (process.env.DEBUG) {
      console.log('\n----------------------------------------\n')
      console.log(util.inspect(response, false, null, true))
    }

    for (const page of response.results) {
      const {
        id,
        created_by,
        created_time,
        last_edited_by,
        last_edited_time,
        properties,
        url
      } = page

      const object = { id }

      for (const key in properties) {
        object[key] = await extractProperty(properties[key])
      }

      const createdBy = await getUser(created_by.id)
      const lastEditedBy = await getUser(last_edited_by.id)

      object['Created By'] = createdBy.name
      object['Created At'] = formatDate(created_time)

      object['Last Edited By'] = lastEditedBy.name
      object['Last Edited At'] = formatDate(last_edited_time)

      object['URL'] = url

      loop.results.push(object)
    }

    loop.cursor = response.next_cursor
    loop.hasMore = response.has_more
  }

  return loop.results
}

module.exports = {
  getNotionDatabase
}
