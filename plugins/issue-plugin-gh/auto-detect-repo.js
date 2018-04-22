// use --repo in form `issuemd/issue` if set, otherwise...
// auto detect github repo, and populate config accordingly
const ajax = require('./ajax')

const autoDetectRepo = async (configRepo, configAutoDectect, configGitRemote) => {
  if (configRepo && /\//.test(configRepo)) {
    const [ namespace, id ] = configRepo.split('/')
    return { namespace, id }
  } else if (configAutoDectect && configGitRemote) {
    // TODO: refactor npm registry lookup
    if (configRepo && !/\//.test(configRepo)) {
      const { body } = await ajax(`http://registry.npmjs.org/${configRepo}`)
      configGitRemote = JSON.parse(body).repository.url
    }
    // https://regexper.com/#/^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/
    // https://regexper.com/#/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/
    const [ discard, namespace, id ] = configGitRemote.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/) || // eslint-disable-line no-unused-vars
      configGitRemote.match(/^(?:git\+)?https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/) || [ null, null, null ]
    return namespace ? { namespace, id } : null
  } else {
    console.log('could not detect repo, try something like: --repo `issuemd/issue`')
    process.exit()
  }
}

module.exports = autoDetectRepo
