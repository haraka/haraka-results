# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [2.2.6] - 2025-03-29

- fix: update deprecated util.isError -> util.types.isNativeError


### [2.2.5] - 2025-01-26

- prettier: move config into package.json
- deps(eslint): upgrade to v9
- deps: bump versions

### [2.2.4] - 2024-04-10

- deps: bump versions
- ci: updated ci.yml
- doc(CHANGES): rename Changes.md -> CHANGELOG.md
- doc(CONTRIBUTORS): added
- populate [files] in package.json. Delete .npmignore.
- dep: eslint-plugin-haraka -> @haraka/eslint-config
- lint: remove duplicate / stale rules from .eslintrc
- prettier

### [2.2.3] - 2023-06-08

- ci: add on pull_request
- dev: expand .gitignore
- packaging: add .npmignore

#### 2.2.2 - 2022-05-28

- feat: add ignores keys with undefined values
- add .release submodule

#### 2.2.1 - 2022-05-27

- chore(ci): depend on shared GHA workflows

#### 2.2.0 - 2022-05-23

- dep(node): require 14+
- dep(redis): bump 3 -> 4
- dep(eslint): bump 7 -> 8
- test: update redis test syntax for v4
- doc(README): deprecate usage of 'plugin'
- doc(README): update badges

#### 2.1.0 - 2021-10-14

- bump redis dep 2.8.0 -> 3.1.2
- replace nodeunit with mocha
- add github workflows, drop travis & appveyor CI
- use es6 classes
- es6: use "for item of array" syntax for array iterator

#### 2.0.3 - 2017-08-26

- add redis_publish boolean to disable redis results publishing

#### 2.0.2 - 2017-06-26

- revert #4, until a proper and tested fix is available

#### 2.0.1 - 2017-05-26

- eslint 4 compat

#### 2.0.0 - 2017-05-26

- Disable Redis pub/sub by default

#### 1.0.2 - 2017-02-13

- publish incr operations
- update eslint to inherit eslint-plugin-haraka
- added AppVeyor (windows) testing

#### 1.0.1 - 2017-01-26

- update eslint to inherit eslint-plugin-haraka

* depend on haraka-config
  - vs ./config, which doesn't work for npm packaged plugin tests

#### 1.0.0 - initial release

[2.1.0]: https://github.com/haraka/haraka-results/releases/tag/2.1.0
[2.2.0]: https://github.com/haraka/haraka-results/releases/tag/2.2.0
[2.2.1]: https://github.com/haraka/haraka-results/releases/tag/2.2.1
[2.2.2]: https://github.com/haraka/haraka-results/releases/tag/2.2.2
[2.2.3]: https://github.com/haraka/haraka-results/releases/tag/v2.2.3
[2.2.4]: https://github.com/haraka/haraka-results/releases/tag/v2.2.4
[2.2.5]: https://github.com/haraka/haraka-results/releases/tag/v2.2.5
[2.2.6]: https://github.com/haraka/haraka-results/releases/tag/v2.2.6
