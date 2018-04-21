'use strict'

const ajax = require('./ajax')

const reform = uri => /^https?:\/\//.test(uri) ? uri : `https://api.github.com${uri}`

const fetchOne = async (uri, token) => {
  const { headers, body } = await ajax(reform(uri) + (token ? `?access_token=${token}` : ''), { headers: {
    'User-Agent': 'issuemd/issue',
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json;charset=UTF-8'
  }})
  return { allHeaders: [headers], out: JSON.parse(body) }
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

const fetchAll = async (uri, token) => {
  const { allHeaders, out } = await fetchOne(reform(uri), token)

  // if there are next links in headers, fetch all and assume out is array and push all responses onto it
  let nextLink = allHeaders[0].link && nextPageUrl(allHeaders[0].link).next
  let safetyNet = 50
  while (nextLink) {
    // just in case we get into an unknown case of endless cycle, don't recurse more than 50 pages
    if (safetyNet-- === 0) {
      throw Error('issue is too big, had to fetch more than 50 pages of api calls!')
    }

    const { allHeaders: innerHeaders, out: body } = await fetchOne(nextLink.url)
    allHeaders.push(innerHeaders[0])
    Array.prototype.push.apply(out, body)
    nextLink = innerHeaders[0].link && nextPageUrl(innerHeaders[0].link).next
  }

  return { out, allHeaders }
}

module.exports = {
  fetchAll,
  fetchOne
}
