# FunctionalScript Updates

1. Formats:
  - Forms: W2, 1099*
  - Bank Statements
  - Expenses (Receipts)
  - Tax Return Config:
    - Entity (SSN)
    - Status ()
    - all other fields, it may include references on other files and entities.
2. FJS Runner:
  - Types:
    - Pure. Subtypes:
        - No imports and no reading
        - Importing by hash
        - Reading by hash
    - Impure:
        - Reference to revision subjects
        - Providing and generating a lock file. The problem with providing a lock file that we may not know which revision subjects the script may ask. At the same time, the first run w/o lock file should generate the lock file and then we can supply to reproduce.
  - Design URL format.
3. Big file uploader. Solutions:
  - CLI. Actually, we can just use `fjs cas add ...`
  - Web Server
4. Decimals and BigIntegers for finance. Proposed solution:
  Type aware JSON parser:
  ```ts
  const parse: <T extends rtti.Type>(type: rtti.Type) => (s: string) => Ts<T>
  ```
  Implementation:
    1. Extend a JSON parse to recognize integer values and return them as bigints.
    2. The standard parser will use the extended parser and convert all bigints to numbers
    3. Our "type-aware JSON parser" will use the extended parser.
  Our forms will use ONLY integers for currencies (cents), percentages, etc. No big-fixed-point-decimals for now. If needed, forms may specify a fixed point positions for some values for the whole JSON. For example, if by default the form assumes that our units are percentages, but a particular form requires a hundredth of percentages, then the form may specify something like `{"percentage-point-position":2}`. We may also select a default value for the all forms. Most likely, for currencies we should use cents (a minimal unit), and for percentages hundredth of percentages. `$100.23 = 10023`, `3.45% = 345`.
5. One API definition. We should have one internal API definition for external gates. All other APIs, such as MCP, CLI, RestAPI, should map to the internal API, with minimal configuration and must not contain business logic at all. The internal API must be defined using RTTI.
6. Currently, by default, we use the `~/.cas/` directory. We should be able to use other directories. Possible solutions:
  1. Use similar to Git algorithm when we search for `.cas/` directory traversing from the current directory to the root. I prefer this one.
  2. Provide a parameter.
7. Unrelated FunctionalScript tasks:
  1. Move `fjs/media/json/rpc` to `fjs/procotol/jsonrpc`.
  2. Generic partial structures for `scan` state.
