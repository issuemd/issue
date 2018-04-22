const issueFromApiJson = require('../issue-from-api-json')

const showHandler = (issue, pullRequests) => {
  if (pullRequests && pullRequests.updated_at) {
    issue.events.push({
      event: 'pull_request',
      actor: {
        login: pullRequests.user.login
      },
      created_at: pullRequests.created_at
    })
  } else {
    const lastCommentOrEventUpdate = issue.events.reduce(function (memo, item) {
      return item.event !== 'referenced' && new Date(item.created_at) > new Date(memo) ? item.created_at : memo
    }, issue.comments.length && issue.comments[issue.comments.length - 1].updated_at)

    // TODO: refactor calculatedUpdateTime
    let calculatedUpdateTime
    if (!lastCommentOrEventUpdate && issue.created_at !== issue.updated_at) {
      calculatedUpdateTime = issue.updated_at
    } else if (!!lastCommentOrEventUpdate && new Date(issue.updated_at) > new Date(lastCommentOrEventUpdate)) {
      calculatedUpdateTime = issue.updated_at
    }

    if (calculatedUpdateTime) {
      const newevent = {
        event: 'update',
        actor: {
          login: issue.user.login
        },
        created_at: calculatedUpdateTime
      }
      issue.events.push(newevent)
    }
  }

  return issue
}

const show = async (api, namespace, repoId, issueId, issuemd, dateStringToIso, personFromParts, width) => {
  const { json: issue } = await api.show(namespace, repoId, issueId)

  const { json: events } = await api.fetchAll(issue.events_url)
  issue.events = events

  const { json: comments } = await api.fetchAll(issue.comments_url)
  issue.comments = comments

  let pullRequests
  if (issue.pull_request) {
    const { json } = await api.fetchAll(issue.pull_request.url)
    pullRequests = json
  }

  return {
    stdout: issueFromApiJson(showHandler(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width)
  }
}

module.exports = show
