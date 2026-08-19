# Remove FunctionalScript Git Submodule

We have two versions of FunctionalScript in the repo. One is from NPM, and the other is a Git submodule. 
IMHO, there is no reason to have the submodule. In case we need more information (e.g. missing documentation), we can either:

1. Release a new version of FunctionalScript (we own it),
2. Reference the Git repo as a dependency instead of NPM. See https://docs.npmjs.com/cli/v10/configuring-npm/package-json?v=true#git-urls-as-dependencies
   I'm not sure whether `prepack` is called during installation from Git. If not, let me know; I will try to fix it.
   It's highly discouraged to run scripts such as emitting `.d.ts` files during installation, but we may not need it if we add the following lines to `tsconfig.json`:
   ```json
    "allowJs": true,                                  /* Allow JavaScript files to be a part of your program. Use the `checkJS` option to get errors from these files. */
    "checkJs": true,                                  /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 100,                        /* Specify the maximum folder depth used for checking JavaScript files from `node_modules`. Only applicable with `allowJs`. */
   ```

