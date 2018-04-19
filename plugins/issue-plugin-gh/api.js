'use strict'

const ajax = require('./ajax')

const fetchOne = async uri => {
  const { headers, body } = await ajax(uri, { headers: {
    'User-Agent': 'issuemd/issue',
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json;charset=UTF-8'
  }})
  return { headers, out: JSON.parse(body) }
}

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
  const { headers, out } = await fetchOne(uri)

  // if there are next links in headers, fetch all and assume out is array and push all responses onto it
  let nextLink = headers.link && nextPageUrl(headers.link).next
  let safetyNet = 50
  while (nextLink) {
    // just in case we get into an unknown case of endless cycle, don't recurse more than 50 pages
    if (safetyNet-- === 0) {
      throw Error('issue is too big, had to fetch more than 50 pages of api calls!')
    }

    const { headers, out: body } = await fetchOne(nextLink.url)
    Array.prototype.push.apply(out, body)
    nextLink = headers.link && nextPageUrl(headers.link).next
  }

  return out
}

module.exports = {
  fetchAll,
  fetchOne
}
