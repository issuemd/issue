'use strict'

const { fetchOneFactory, fetchAllFactory, basicAuthHeader } = require('./api-helpers')

module.exports = token => {
  const fetch = fetchOneFactory(token)
  const fetchAll = fetchAllFactory(token)

  const RecursiveFactory = (initialUri, callback) => {
    const inception = async uri => {
      const { json, nextPageUrl } = await fetch(uri)
      const next = nextPageUrl.next && (() => inception(nextPageUrl.next.url))
      return callback(json, next)
    }
    return inception(initialUri)
  }

  const locate = (q, callback) => RecursiveFactory(`/search/repositories?q=${q}`, callback)

  const list = (namespace, id, callback) => RecursiveFactory(`/repos/${namespace}/${id}/issues`, callback)

  const rateLimit = () => fetch('/rate_limit')

  const show = (namespace, id, issueId) => fetchAll(`/repos/${namespace}/${id}/issues/${issueId}`)

  const authorizations = (username, password) => fetch('/authorizations', basicAuthHeader(username, password))

  const revokeAuthorization = (username, password, tokenId) => fetch(`/authorizations/${tokenId}`, basicAuthHeader(username, password), 'DELETE')

  const createAuthorizationToken = (username, password, tokenName) => fetch('/authorizations', basicAuthHeader(username, password), 'POST', {
    scopes: ['user', 'repo', 'gist'],
    note: tokenName
  })

  return {
    rateLimit,
    locate,
    list,
    show,
    authorizations,
    revokeAuthorization,
    createAuthorizationToken,
    fetch,
    fetchAll
  }
}
