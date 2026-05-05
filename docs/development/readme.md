# Developer documentation

## Setting up

### Private package access

This project depends on private Solvimon packages published to the GitLab npm
package registry. To install dependencies locally, npm needs a
`GITLAB_NPM_TOKEN` with read access to the package registry.

The recommended local setup is to use `direnv`, so the token is loaded
automatically when you enter the project directory.

1. Install `direnv`.

```sh
brew install direnv
```

2. Enable the shell hook for zsh by adding this to `~/.zshrc`.

```sh
eval "$(direnv hook zsh)"
```

3. Create a local `.env` file from `.env.example`.

```sh
cp .env.example .env
```

4. Set your GitLab npm token in `.env`.

```dotenv
GITLAB_NPM_TOKEN=your-token-here
```

5. Allow this project's `.envrc` file.

```sh
direnv allow
```

After this, `GITLAB_NPM_TOKEN` is exported automatically whenever you `cd` into
the project, and `npm install` can install the private packages.

To verify that npm can access the private package registry, run:

```sh
npm view @solvimon/solvimon-ui version --registry=https://gitlab.com/api/v4/projects/38958827/packages/npm/
```

The `.env` file contains secrets and must not be committed.
