// use --repo in form `issuemd/issue` if set, otherwise...
// auto detect github repo, and populate config accordingly

const autoDetectRepo = (configRepo, configAutoDectect, configGitRemote) => {
  if (configRepo) {
    const [ namespace, id ] = configRepo.split('/')
    return { namespace, id }
  } else if (configAutoDectect && configGitRemote) {
        // https://regexper.com/#/^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/
        // https://regexper.com/#/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/
    const [ discard, namespace, id ] = configGitRemote.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/) || // eslint-disable-line no-unused-vars
            configGitRemote.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/) || [ null, null, null ]
    return namespace ? { namespace, id } : null
  } else {
    console.log('could not detect repo, try something like: --repo `issuemd/issue`')
    process.exit()
  }
}

module.exports = autoDetectRepo
