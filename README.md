# issue

Command line tool for displaying issues using the [issuemd library](https://github.com/issuemd/issuemd).

**GitHub** plugin is included.

**issue** can be extended with plugins for different issue tracking systems.

## Installation

    $ npm install -g issue 

## Usage (GitHub plugin)

### Show list of issues from local GitHub repo

`cd` into local GitHub repo and run `show` command...

    $ cd bootstrap
    $ issue github show

### Show list of issues from online GitHub repo

Specify the target project with the `--repo` flag

    $ issue github show --repo twbs/bootstrap

### Show individual issue

To show individual issue, add the issue number as the last argument...

    $ issue github show --repo twbs/bootstrap <issue-number>

... or from within github project ...

    $ issue github show <issue-number>

### Show filtered list of issues

The `show` command supports standard GitHub filters: `'filter', 'state', 'labels', 'sort', 'direction', 'since'`

    $ issue github show --state open
    
### Search repositories

    $ issue github search <search-term>

Search command can be used to search any repositories on GitHub.

Standard GitHub filters are supported: `'in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars'`

For example, to list all repositories containing `bootstrap` keyword written in assembly.

    $ issue github search bootstrap --language assembly

### Limit check

If you are not logged in, GitHub limits you to 60 core requests per half hour, but if logged in, you get 5000. 

    $ issue github limit

Output:

    core requests: 27/60, resets in: 24 mins
    search requests: 10/10, resets in: 2 mins

### GitHub login

    $ issue github login

To increase the request limit, and get access to your own private repositories you should login with your GitHub credentials.

GitHub login creates a **_personal access token_** for issuemd on your GitHub account. **_Personal access tokens_** are named:

    $ issuemd/issue-<username>@<computer-name>

This enables you to login and use **issue** from multilple locations at the same time.

GitHub logout command clears out credentials from your `.issuerc` configuration file.

    $ issue github logout

## Configuration

Change directory to where you want to store your configuration, and run init command...

  ```
  $ issue init
  ```
  
This will create `.issuerc` configuration file in your current directory - typically your home folder, or in a project folder to create overrides.
