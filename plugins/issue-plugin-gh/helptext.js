module.exports = `
Locate github repos, search for, list, export and display details for issues...

  issue github locate <search-term>                      - locate github repo

  issue github list --repo <user/name>                   - list issues for repo
  issue github search <search-term> --repo <user/name>   - search issues in repo
  issue github show --repo <user/name> <id>              - display specified issue

  issue github export --repo <user/name> --dest <export-path> --answer <yes-no>
                                                         - display specified issue

  issue github limit                                     - display api rate limit

  issue github login                                     - authenticate with github
  issue github logout                                    - remove github credentials

e.g.

  issue github locate chancejs
  issue github list --repo victorquinn/chancejs
  issue github search --repo victorquinn/chancejs Ooof
  issue github show --repo victorquinn/chancejs 207
  issue github export --dest issues --answer yes --repo victorquinn/chancejs Ooof

  issue github limit
  issue github login
  issue github limit
`.trim()
