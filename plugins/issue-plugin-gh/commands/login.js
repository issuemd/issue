const os = require('os')

const auth = require('../auth')

const login = async (api, configGenerator, configUsername, configPassword, captureCredentials) => {
  // first logout, which ensures userconfig is writable
  // TODO: better error handling, i.e. throw
  const err = await auth(configGenerator)
  if (!err) {
    const { username, password } = await captureCredentials(configUsername, configPassword)
    const hostname = os.hostname()
    const tokenName = `issuemd/issue-${username}@${hostname}`

    const { json: tokens } = await api.authorizations(username, password)
    const token = tokens.filter(({ note }) => note === tokenName)[0]
    const tokenId = token && token.id

    // TODO: handle error in revoke
    // const revoked = !tokenId ? {} : await api.revokeAuthorization(username, password, tokenId)
    await api.revokeAuthorization(username, password, tokenId)

    const { json: newToken } = await api.createAuthorizationToken(username, password, tokenName)

    const err = auth(configGenerator, newToken.token, newToken.id)
    if (!err) {
      return {
        stdout: 'Logged in'
      }
    } else {
      return {
        stdout: 'Problem logging in!'
      }
    }
  } else {
    return {
      stdout: 'Problem logging out!'
    }
  }
}

module.exports = login
