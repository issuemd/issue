'use strict';

const bent = require('bent')

const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const helptext = require('./helptext')

const getBent = bent('json', {
    'User-Agent': 'issuemd/issue',
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json;charset=UTF-8'
})

module.exports = ({ issuemd, dateStringToIso, personFromParts }) => async config => {
    const { width, command, params, repo, git, plugins: { github } } = config

    const rest = url => {
        return getBent(`${url}?access_token=${github.authToken}`)
    }

    const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

    if (command === 'show' && params.length) {
        const issue = await show(githubrepo.namespace, githubrepo.id, params[0], rest)
        return issueFromApiJson(issue, issuemd, dateStringToIso, personFromParts).toString(width);
    } else {
        return helptext
    }
};
