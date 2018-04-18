'use strict'

const url = require('url')
const http = require('http')
const https = require('https')

const ajax = (uri, opts) => new Promise((resolve, reject) => {
  const parsedUri = url.parse(uri)
  const protocol = parsedUri.protocol === 'https:' ? https : http
  protocol.get(Object.assign(parsedUri, opts), res => {
    res.setEncoding('utf8')
    res.body = ''
    res.on('data', data => (res.body += data))
    res.on('end', () => resolve(res))
  })
})

module.exports = ajax
