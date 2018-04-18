'use strict'

const { fetchAll } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const helptext = require('./helptext')

module.exports = ({ issuemd, dateStringToIso, personFromParts }) => async config => {
    const { width, command, params, repo, git, plugins: { github } } = config

    const apiFetchWithAuth = url => fetchAll(`${url}?access_token=${github.authToken}`)

    const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

    if (command === 'show' && params.length) {
        const issue = await show(githubrepo.namespace, githubrepo.id, params[0], apiFetchWithAuth)
        return issueFromApiJson(issue, issuemd, dateStringToIso, personFromParts).toString(width)
    } else {
        return helptext
    }
}
