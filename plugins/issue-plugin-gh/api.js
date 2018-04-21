'use strict'

const rest = require('./rest')

const nextPageUrl = link => {
  const urls = {}

  if (link) {
    // http://regexper.com/#/<(.*?(\d+))>;\s*rel="(.*?)"/g
    link.replace(/<(.*?(\d+))>;\s*rel="(.*?)"/g, (_, url, page, name) => {
      urls[name] = { url: url, page: page * 1 }
    })
  }

  return urls
}

const fetchAll = async uri => {
  const { headers, data } = await rest(uri)
  let lastHeaders = headers
  // if there are next links in headers, fetch all and assume data is array and push all responses onto it
  let nextLink = headers.link && nextPageUrl(headers.link).next
  let safetyNet = 50
  while (nextLink) {
    // just in case we get into an unknown case of endless cycle, don't recurse more than 50 pages
    if (safetyNet-- === 0) {
      throw Error('issue is too big, had to fetch more than 50 pages of api calls!')
    }

    const { headers: innerHeaders, data: innerData } = await rest(nextLink.url)
    lastHeaders = innerHeaders
    Array.prototype.push.apply(data, innerData)
    nextLink = innerHeaders.link && nextPageUrl(innerHeaders.link).next
  }

  return { data, headers: lastHeaders }
}

module.exports = {
  fetchAll,
  fetchOne: rest
}
