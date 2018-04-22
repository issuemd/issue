'use strict'

const _ = require('lodash')
const { fetchOneFactory, fetchAllFactory, basicAuthHeader } = require('./api-helpers')

module.exports = (token, config) => {
  const fetch = fetchOneFactory(token)
  const fetchAll = fetchAllFactory(token)

  const queryStringify = (...args) => {
    const qs = Object.entries(Object.assign({}, ...args)).map(([key, value]) => `${key}=${value}`).join('&')
    return qs ? `?${qs}` : ''
  }

  const qualifyify = (q, ...args) => {
    const qs = Object.entries(Object.assign({}, ...args)).map(([key, value]) => `${key}:${value}`).join('+')
    return `?q=${q}${qs ? `+${qs}` : ''}`
  }

  const RecursiveFactory = (initialUri, callback) => {
    const inception = async uri => {
      const { json, nextPageUrl } = await fetch(uri)
      const next = nextPageUrl.next && (() => inception(nextPageUrl.next.url))
      return callback(json, next)
    }
    return inception(initialUri)
  }

  const listFilters = ['milestone', 'state', 'assignee', 'creator', 'mentioned', 'labels', 'sort', 'direction', 'since']
  const searchFilters = ['author', 'involves']

  const locate = (q, callback) => RecursiveFactory(`/search/repositories${queryStringify({ q })}`, callback)

  const list = (namespace, id, callback) => RecursiveFactory(`/repos/${namespace}/${id}/issues${queryStringify(_.pick(config, listFilters))}`, callback)

  // TODO: allow search without repo set
  const search = (q, namespace, id, callback) => {
    const repoQualifier = {}
    if (namespace && id) {
      repoQualifier.repo = `${namespace}/${id}`
    }
    return RecursiveFactory(`/search/issues${qualifyify(q, repoQualifier, _.pick(config, searchFilters))}`, callback)
  }

  const rateLimit = () => fetch('/rate_limit')

  const show = (namespace, id, issueId) => fetchAll(`/repos/${namespace}/${id}/issues/${issueId}`)

  const authorizations = (username, password) => fetch('/authorizations', basicAuthHeader(username, password))

  const revokeAuthorization = (username, password, tokenId) => fetch(`/authorizations/${tokenId}`, basicAuthHeader(username, password), 'DELETE')

  const createAuthorizationToken = (username, password, tokenName) => fetch('/authorizations', basicAuthHeader(username, password), 'POST', {
    scopes: ['user', 'repo', 'gist'],
    note: tokenName
  })

  return {
    fetch,
    fetchAll,
    locate,
    list,
    search,
    rateLimit,
    show,
    authorizations,
    revokeAuthorization,
    createAuthorizationToken
  }
}
