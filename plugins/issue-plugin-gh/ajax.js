'use strict'

const url = require('url')
const http = require('http')
const https = require('https')

const ajax = (uri, headers, handler = i => i, method = 'GET', postData) => new Promise((resolve, reject) => {
  const parsedUri = url.parse(uri)
  const protocol = parsedUri.protocol === 'https:' ? https : http
  const req = protocol.request(Object.assign(parsedUri, { headers, method }), res => {
    res.setEncoding('utf8')
    res.body = ''
    res.on('data', data => (res.body += data))
    res.on('end', () => resolve(handler(res)))
  })
  if (postData) {
    req.write(postData)
  }
  req.end()
})

module.exports = ajax
