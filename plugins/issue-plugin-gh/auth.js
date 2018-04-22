const logout = (configGenerator, token = '', tokenId = '') => {
  try {
    configGenerator('plugins.github.authToken', token, true)
    configGenerator('plugins.github.authTokenId', tokenId, true)
    return 0
  } catch (err) {
    return { err }
  }
}

module.exports = logout
