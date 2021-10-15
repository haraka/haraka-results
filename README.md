# haraka-results

[![Build Status][ci-img]][ci-url]
[![Code Coverage][cov-img]][cov-url]
[![Code Climate][clim-img]][clim-url]
[![NPM][npm-img]][npm-url]

Add, log, retrieve, and share the results of plugin tests.

## Synopsis

Results is a structured way of storing results from plugins across a
session, allowing those results to be retrieved later or by other plugins.

Results objects are present on every Haraka connection *and* transaction. When
in a SMTP transaction, results from *both* are applicable to that transaction.

## Usage

Use results in your plugins like so:

```js
exports.my_first_hook = function (next, connection) {
    let plugin = this

    // run a test
    ......

    // store the results
    connection.results.add(plugin, {pass: 'my great test' })

    // run another test
    .....

    // store the results
    connection.results.add(plugin, {fail: 'gotcha!', msg: 'show this'})
}
```

Store the results in the transaction (vs connection):

```js
   connection.transaction.results.add(plugin, {...});`
```

### Config options

Each plugin can have custom settings in results.ini to control results logging.
There are three options available: hide, order, and debug.

* hide - a comma separated list of results to hide from the output
* order - a comman separated list, specifing the order of items in the output
* debug - log debug messages every time results are called

```ini
; put this in config/results.ini
[plugin_name]
hide=skip
order=msg,pass,fail
debug=0
```

### Results Functions

#### add

Store information. Most calls to `results` will append data to the lists
in the connection. The following lists are available:

    pass  - names of tests that passed
    fail  - names of tests that failed
    skip  - names of tests that were skipped (with a why, if you wish)
    err   - error messages encountered during processing
    msg   - arbitratry messages

    human - a custom summary to return (bypass collate)
    emit  - log an INFO summary

When err results are received, a logerror is automatically emitted, saving the
need to specify {emit: true} with the request.

Examples:

```js
    const results = connection.results
    results.add(plugin, {pass: 'null_sender'})
    results.add(plugin, {fail: 'single_recipient'})
    results.add(plugin, {skip: 'valid_bounce'}
    results.add(plugin, {err: 'timed out looking in couch cushions'})
    results.add(plugin, {msg: 'I found a nickel!', emit: true})
```

In addition to appending values to the predefined lists, arbitrary results
can be stored in the cache:

```js
    results.add(plugin, {my_result: 'anything I want'})
```

When arbirary values are stored, they are listed first in the log output. Their
display can be suppressed with the **hide** option in results.ini.


#### incr

Increment counters. The argument to incr is an object with counter names and
increment values. Examples:

```js
    results.incr(plugin, {unrecognized_commands: 1})

    results.incr(plugin, {karma: -1})
    results.incr(plugin, {karma:  2})
```


#### push

Append items onto arrays. The argument to push is an object with array names and
the new value to be appended to the array. Examples:

```js
    results.push(plugin, {dns_recs: 'name1'})
    results.push(plugin, {dns_recs: 'name2'})
```

#### collate

```js
    const summary = results.collate(plugin)
```

Formats the contents of the result cache and returns them. This function is
called internally by `add()` after each update.


#### get

Retrieve the stored results as an object. The only argument is the name of the
plugin whose results are desired.

```js
    const geoip = results.get('geoip')
    if (geoip && geoip.distance && geoip.distance > 2000) {
        ....
    }
```

Keep in mind that plugins also store results in the transaction. Example:

```js
    const sa = connection.transaction.results.get('spamassassin')
    if (sa && sa.score > 5) {
        ....
    }
```

#### has

Check result contents for string or pattern matches.

Syntax:

```js
    results.has('plugin_name', 'result_name', 'search_term')
```

* result\_name: the name of an array or string in the result object
* search\_term: a string or RegExp object


### More Examples

#### Store Results:

```js
    results.add(plugin, {pass: 'some_test'})
    results.add(plugin, {pass: 'some_test(with reason)'})
```

#### Retrieve exact match with **get**:

```js
    if (results.get('plugin_name').pass.indexOf('some_test') !== -1) {
        // some_test passed (1x)
    }
```

#### Retrieve a string match with **has**

```js
    if (results.has('plugin_name', 'pass', 'some_test')) {
        // some_test passed (1x)
    }
```

The syntax for using **has** is a little more pleasant.

Both options require one to check for each reason which is unpleasant when
and all we really want to know is if some\_test passed or not.

#### Retrieve a matching pattern:

```js
    if (results.has('plugin_name', 'pass', /^some_test/)) {
        // some_test passed (2x)
    }
```

### Private Results

To store structured data in results that are hidden from the human and
human_html output, prefix the name of the key with an underscore.

Example:

```js
    results.add(plugin, { _hidden: 'some data' })
```

## Redis Pub/Sub

If a redis client is found on server.notes.redis, then new results are JSON
encoded and published to Redis on the channel named `result-${UUID}`. This
feature can be disabled by setting `[main]redis_publish=false` in results.ini.
Plugins can recieve the events by psubscribing (pattern subscribe) to the
channel named `result-${UUID}*` where ${UUID} is the connection UUID.

This is from the karma plugin subscribing on the `connect_init` hook:

```js
exports.register = function (next, server) {
    this.inherits('redis')

    register_hook('connect_init', 'redis_subscribe');
    register_hook('disconnect',   'redis_unsubscribe');
}

exports.redis_subscribe = function (next, connection) {
    const plugin = this

    plugin.redis_subscribe(connection, function () {
        connection.notes.redis.on('pmessage', (pattern, channel, message) => {
            // do stuff with messages that look like this
            // {"plugin":"karma","result":{"fail":"spamassassin.hits"}}
            // {"plugin":"geoip","result":{"country":"CN"}}
        })
        next()
    })
}
exports.redis_unsubscribe = function (next, connection) {
    this.redis_unsubscribe(connection)
}
```


[ci-img]: https://github.com/haraka/haraka-results/actions/workflows/ci-test.yml/badge.svg
[ci-url]: https://github.com/haraka/haraka-results/actions/workflows/ci-test.yml
[cov-img]: https://codecov.io/github/haraka/haraka-results/coverage.svg
[cov-url]: https://codecov.io/github/haraka/haraka-results
[clim-img]: https://codeclimate.com/github/haraka/haraka-results/badges/gpa.svg
[clim-url]: https://codeclimate.com/github/haraka/haraka-results
[npm-img]: https://nodei.co/npm/haraka-results.png
[npm-url]: https://www.npmjs.com/package/haraka-results
