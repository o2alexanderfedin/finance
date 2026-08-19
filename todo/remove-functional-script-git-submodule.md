# Remove FunctionalScript Git Submodule

We have two versions of FunctionalScript in the repo. One is from NPM, and the other is a Git submodule. 
IMHO, there is no reason to have the submodule. In case we need more information (e.g. missing documentation), we can either:

1. Release a new version of FunctionalScript (we own it),
2. Reference the Git repo as a dependency instead of NPM. See https://docs.npmjs.com/cli/v10/configuring-npm/package-json?v=true#git-urls-as-dependencies
