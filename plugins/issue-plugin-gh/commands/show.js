const show = async (namespace, reponame, issueid, apiFetchWithAuth) => {
  const issue = await apiFetchWithAuth(`https://api.github.com/repos/${namespace}/${reponame}/issues/${issueid}`)
  issue.events = await apiFetchWithAuth(issue.events_url)
  issue.comments = await apiFetchWithAuth(issue.comments_url)
  const pullRequests = issue.pull_request ? await apiFetchWithAuth(issue.pull_request.url) : null

  require('fs').writeFileSync('data.json', JSON.stringify({ issue, pullRequests }, null, 2))

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

module.exports = show
