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

  return user
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

  const types = {
    // Checkbox
    checkbox: property => formatBoolean(property.checkbox),

    // Created By
    created_by: property => cacheUser(property.created_by).name ?? '',

    // Created Time
    created_time: property => formatDate(property.created_time ?? ''),

    // Date
    date: property => {
      const { start, end } = property.date || {}
      return [formatDate(start), formatDate(end)].filter(Boolean).join(' - ')
    },

    // Email
    email: (property) => property.email,

    // Files
    // TODO: Implement files

    // Formula
    formula: property => {
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
    },

    // Last Edited Time
    last_edited_time: property => formatDate(property.last_edited_time),

    // Last Edited By
    last_edited_by: property => cacheUser(property.last_edited_by).name ?? '',

    // Multi Select
    multi_select: property => property.multi_select.map(
      select => select?.name
    ).join('\n'),

    // Number
    number: property => formatNumber(property.number),

    // Phone Number
    phone_number: property => property.phone_number,

    // Relation
    relation: async property => {
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
    },

    // Rich Text
    rich_text: property => property.rich_text.map(
      text => text.plain_text
    ).join('\n'),

    // Rollup
    rollup: async property => {
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
    },

    // Select
    select: property => property.select?.name || '',

    // Status
    status: property => property.status?.name || '',

    // Title
    title: property => {
      const title = property.title[0]
      return title?.text?.content || title?.plain_text || ''
    },

    // Unique ID
    unique_id: property => {
      const { prefix, number } = property.unique_id
      return [prefix, number].filter(Boolean).join('-')
    },

    // URL
    url: property => property.url
  }

  const type = property.type

  if (types[type]) {
    return types[type](property)
  }

  return ''
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

    if (/true/i.test(process.env.DEBUG)) {
      console.log('\n----------------------------------------\n')
      console.log(util.inspect(response, false, null, true))
    }

    for (const page of response.results) {
      const { id, properties, url } = page

      const object = { id }

      for (const key in properties) {
        object[key] = await extractProperty(properties[key])
      }

      const createdBy = await getUser(page.created_by.id)
      const lastEditedBy = await getUser(page.last_edited_by.id)

      object['Created By'] = createdBy.name
      object['Created At'] = formatDate(page.created_time)

      object['Last Edited By'] = lastEditedBy.name
      object['Last Edited At'] = formatDate(page.last_edited_time)

      object.URL = url

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
