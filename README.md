# Finance

## Goal

The main target is that a user is able to upload their documents to a personal CAS and then use ChatGPT (or other clients) to compute tax and other financial reports.

MVP:
- store financial documents in CAS (using Evo objects, see FunctionalScript repo).
- parse documents
- compute taxes for specified year.
- ChatGPT (or other agent) shouldn't form financial reports directly, it should create a FunctionalScript program that computes the report. It means the MCP server should support execution of FunctionalScript in content-addressable space. As the first implementation, the MCP server will use Node (or other JavaScript engine) to execute the scripts. Later, `fjs` should replace it. We should also define Effects for CAS.

## Conventions And Technical Principles

### FunctionalScript

As contributors and owners of [FunctionalScript](https://github.com/functionalscript/functionalscript) we will use it and our code should be mostly `fjs/*.f.js` files. Consider FunctionalScript as an open source part of the project, we update and release a new version of FunctionalScript at any time. For example, if we need a new Node effect.

### Specifications And Issues

Keep specifications, issues, bug reports, feature requests etc in `**/todo/` directories as MarkDown files, e.g. `./fjs/todo/implement-mcp-server.md`

### New File Formats

Currently, FunctionalScript declares at least one new format [Revision](https://github.com/functionalscript/functionalscript/blob/main/fjs/media/revision/README.md). Use the same principles to define new format: JSON, dialect. Name the dialect `vnd.fjs.<name>`; the media type derives from it as `application/vnd.fjs.<name>+json` — as `vnd.fjs.revision` yields `application/vnd.fjs.revision+json`.
