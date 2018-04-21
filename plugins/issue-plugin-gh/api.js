'use strict'

const ajax = require('./ajax')

const fetchOne = (uri, progressCallback) => ajax(uri, {
  'User-Agent': 'issuemd/issue',
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json;charset=UTF-8'
}, res => {
  try {
    res.json = JSON.parse(res.body)
  } catch (err) {}
  progressCallback && progressCallback(res.headers)
  res.nextPageUrl = nextPageUrl(res.headers.link)
  return res
})

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

const fetchAll = async (uri, progressCallback) => {
  const { headers, json } = await fetchOne(uri, progressCallback)
  let lastHeaders = headers
  // if there are next links in headers, fetch all and assume json is array and push all responses onto it
  let nextLink = headers.link && nextPageUrl(headers.link).next
  let safetyNet = 50
  while (nextLink) {
    // just in case we get into an unknown case of endless cycle, don't recurse more than 50 pages
    if (safetyNet-- === 0) {
      throw Error('issue is too big, had to fetch more than 50 pages of api calls!')
    }

    const { headers: innerHeaders, json: innerData } = await fetchOne(nextLink.url, progressCallback)
    lastHeaders = innerHeaders
    Array.prototype.push.apply(json, innerData)
    nextLink = innerHeaders.link && nextPageUrl(innerHeaders.link).next
  }

  return { json, headers: lastHeaders }
}

module.exports = {
  fetchAll,
  fetchOne
}
