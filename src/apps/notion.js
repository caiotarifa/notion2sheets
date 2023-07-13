const Bottleneck = require('bottleneck')
const { Client } = require('@notionhq/client')

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 334 // ~3 allowed requests per second
})

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const pageCache = {}

async function getPage (pageId) {
  if (!pageCache[pageId]) {
    pageCache[pageId] = await limiter.schedule(() =>
      notion.pages.retrieve({ page_id: pageId })
    )
  }

  return pageCache[pageId]
}

async function extractProperty (property) {
  switch (property.type) {
    // ID
    case 'unique_id':
      return property.unique_id.number

    // Number
    case 'number':
      return property.number

    // Title
    case 'title':
      const title = property.title[0]
      return title?.text?.content || title?.plain_text || ''

    // People
    case 'people':
      return property.people.map(person => person.name).join(', ')

    case 'created_by':
      return property.created_by.name ?? ''

    // Selects
    case 'select':
      return property.select?.name ||  ''

    case 'multi_select':
      return property.multi_select.map(select => select?.name).join(', ')

    // Relation
    case 'relation':
      if (property.relation.length) {
        const relations = []

        for (const relation of property.relation) {
          const { properties } = await getPage(relation.id)
    
          for (const key in properties) {
            if (properties[key].type === 'title') {
              const title = await extractProperty(properties[key])
              relations.push(title)
              break
            }
          }
        }
    
        return relations.join(', ')
      }

      return ''

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

    for (const page of response.results) {
      const { id, created_time, last_edited_time, properties } = page
      const object = { id }

      for (const key in properties) {
        object[key] = await extractProperty(properties[key])
      }

      object.created_time = created_time
      object.last_edited_time = last_edited_time

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
