const auth = require('../auth')

const logout = async configGenerator => {
  // TODO: attempt to revoke token remotely
  const err = await auth(configGenerator)
  return {
    stdout: err ? 'Error logging out' : 'Logged out from issue github'
  }
}

module.exports = logout
