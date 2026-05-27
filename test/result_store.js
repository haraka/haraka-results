'use strict'

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('haraka-test-fixtures')
const Results = require('../index')

beforeEach(() => {
  this.connection = fixtures.connection.createConnection()
  this.connection.results = new Results(this.connection)
})

describe('default_result', () => {
  it('init add', () => {
    this.connection.results.add('test_plugin', { pass: 'test pass' })
    const r = this.connection.results.get('test_plugin')
    assert.deepEqual(r.pass, ['test pass'])
    assert.deepEqual(r.fail, [])
    assert.deepEqual(r.msg, [])
    assert.deepEqual(r.err, [])
    assert.deepEqual(r.skip, [])
  })

  it('init add array', () => {
    this.connection.results.add('test_plugin', { pass: 1 })
    this.connection.results.add('test_plugin', { pass: [2, 3] })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, [1, 2, 3])
  })

  it('init incr', () => {
    this.connection.results.incr('test_plugin', { counter: 1 })
    assert.equal(this.connection.results.get('test_plugin').counter, 1)
  })

  it('init push', () => {
    this.connection.results.push('test_plugin', { pass: 'test1' })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, ['test1'])
  })

  it('init push array', () => {
    this.connection.results.push('test_plugin', { pass: 'test1' })
    this.connection.results.push('test_plugin', { pass: ['test2'] })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, [
      'test1',
      'test2',
    ])
  })

  it('init push, other', () => {
    this.connection.results.push('test_plugin', { other: 'test2' })
    assert.deepEqual(this.connection.results.get('test_plugin').other, [
      'test2',
    ])
  })
})

describe('add err unpacking', () => {
  it('Error object is stored as message string', () => {
    this.connection.results.add('test_plugin', {
      err: new Error('something went wrong'),
    })
    const r = this.connection.results.get('test_plugin')
    assert.deepEqual(r.err, ['something went wrong'])
  })

  it('plain string err is stored as-is', () => {
    this.connection.results.add('test_plugin', { err: 'plain error' })
    assert.deepEqual(this.connection.results.get('test_plugin').err, [
      'plain error',
    ])
  })

  it('array of Error objects unpacks all messages', () => {
    this.connection.results.add('test_plugin', {
      err: [new Error('first'), new Error('second')],
    })
    assert.deepEqual(this.connection.results.get('test_plugin').err, [
      'first',
      'second',
    ])
  })

  it('mixed array of errors and strings unpacks only Error instances', () => {
    this.connection.results.add('test_plugin', {
      err: [new Error('err-obj'), 'plain-str'],
    })
    assert.deepEqual(this.connection.results.get('test_plugin').err, [
      'err-obj',
      'plain-str',
    ])
  })
})

describe('has', () => {
  it('has, list, string', () => {
    this.connection.results.add('test_plugin', { pass: 'test pass' })
    assert.equal(
      this.connection.results.has('test_plugin', 'pass', 'test pass'),
      true,
    )
    assert.equal(
      this.connection.results.has('test_plugin', 'pass', 'test miss'),
      false,
    )
  })

  it('has, list, number', () => {
    this.connection.results.add('test_plugin', { msg: 1 })
    assert.equal(this.connection.results.has('test_plugin', 'msg', 1), true)
    assert.equal(this.connection.results.has('test_plugin', 'msg', 2), false)
  })

  it('has, list, boolean', () => {
    this.connection.results.add('test_plugin', { msg: true })
    assert.equal(this.connection.results.has('test_plugin', 'msg', true), true)
    assert.equal(
      this.connection.results.has('test_plugin', 'msg', false),
      false,
    )
  })

  it('has, list, regexp', () => {
    this.connection.results.add('test_plugin', { pass: 'test pass' })
    assert.ok(this.connection.results.has('test_plugin', 'pass', /test/))
    assert.ok(this.connection.results.has('test_plugin', 'pass', / pass/))
    assert.equal(
      this.connection.results.has('test_plugin', 'pass', /not/),
      false,
    )
  })

  it('has, string, string', () => {
    this.connection.results.add('test_plugin', { random_key: 'string value' })
    assert.ok(
      this.connection.results.has('test_plugin', 'random_key', 'string value'),
    )
    assert.equal(
      this.connection.results.has('test_plugin', 'random_key', 'strings'),
      false,
    )
  })

  it('has, string, regex', () => {
    this.connection.results.add('test_plugin', { random_key: 'string value' })
    assert.ok(
      this.connection.results.has('test_plugin', 'random_key', /string/),
    )
    assert.ok(this.connection.results.has('test_plugin', 'random_key', /value/))
    assert.equal(
      this.connection.results.has('test_plugin', 'random_key', /miss/),
      false,
    )
  })

  it('returns false for unknown plugin', () => {
    assert.equal(
      this.connection.results.has('no_such_plugin', 'pass', 'x'),
      false,
    )
  })

  it('returns false for unknown list on known plugin', () => {
    this.connection.results.add('test_plugin', { pass: 'foo' })
    assert.equal(
      this.connection.results.has('test_plugin', 'no_such_list', 'foo'),
      false,
    )
  })

  it('returns false when stored value is neither string nor array', () => {
    this.connection.results.add('test_plugin', { score: 42 })
    assert.equal(this.connection.results.has('test_plugin', 'score', 42), false)
  })

  it('_has_string returns false for non-string non-regex search', () => {
    this.connection.results.add('test_plugin', { random_key: 'hello' })
    assert.equal(
      this.connection.results.has('test_plugin', 'random_key', 42),
      false,
    )
  })
})

describe('_get_order / _get_hide', () => {
  it('_get_order returns [] when config has no order', () => {
    assert.deepEqual(this.connection.results._get_order(undefined), [])
    assert.deepEqual(this.connection.results._get_order({}), [])
  })

  it('_get_order splits comma/semicolon/space-separated values', () => {
    assert.deepEqual(
      this.connection.results._get_order({ order: ' pass, fail; skip msg ' }),
      ['pass', 'fail', 'skip', 'msg'],
    )
  })

  it('_get_hide returns [] when config has no hide', () => {
    assert.deepEqual(this.connection.results._get_hide(undefined), [])
    assert.deepEqual(this.connection.results._get_hide({}), [])
  })

  it('_get_hide splits comma/semicolon/space-separated values', () => {
    assert.deepEqual(
      this.connection.results._get_hide({ hide: 'pass;fail, skip' }),
      ['pass', 'fail', 'skip'],
    )
  })
})

describe('private_collate', () => {
  it('arrays are shown in output', () => {
    this.connection.results.push('test_plugin', { foo: 'bar' })
    assert.equal(this.connection.results.has('test_plugin', 'foo', /bar/), true)
    assert.ok(/bar/.test(this.connection.results.get('test_plugin').human))
  })

  it('underscore-prefixed keys are not shown', () => {
    this.connection.results.add('test_plugin', { _private: 'secret' })
    const human = this.connection.results.collate('test_plugin')
    assert.ok(!/_private/.test(human), `unexpected: ${human}`)
    assert.ok(!/secret/.test(human), `unexpected: ${human}`)
  })

  it('non-array object values are not shown', () => {
    this.connection.results.add('test_plugin', { nested: { a: 1 } })
    const human = this.connection.results.collate('test_plugin')
    assert.ok(!/nested/.test(human), `unexpected: ${human}`)
  })

  it('honors order from config', () => {
    this.connection.results.add('helo.checks', {
      pass: 'p',
      fail: 'f',
      msg: 'm',
    })
    const human = this.connection.results.collate('helo.checks')
    assert.ok(/fail:f.*pass:p.*msg:m/.test(human), `unexpected: ${human}`)
  })

  it('honors hide from config (predefined list key)', () => {
    this.connection.results.add('dnsbl', { pass: 'hidden', fail: 'shown' })
    const human = this.connection.results.collate('dnsbl')
    assert.ok(!/pass:/.test(human), `unexpected: ${human}`)
    assert.ok(/fail:shown/.test(human), `unexpected: ${human}`)
  })

  it('honors hide from config (arbitrary key)', () => {
    this.connection.results.add('karma', { todo: 'hide-me', score: 5 })
    const human = this.connection.results.collate('karma')
    assert.ok(!/todo/.test(human), `unexpected: ${human}`)
    assert.ok(/score: 5/.test(human), `unexpected: ${human}`)
  })
})

describe('get', () => {
  beforeEach(() => {
    this.connection = fixtures.connection.createConnection()
    this.connection.results = new Results(this.connection)
    this.connection.results.add('test_plugin', { pass: 'foo' })
  })

  it('by plugin object', () => {
    assert.equal(
      this.connection.results.get({ name: 'test_plugin' }).pass[0],
      'foo',
    )
  })

  it('by plugin name string', () => {
    assert.equal(this.connection.results.get('test_plugin').pass[0], 'foo')
  })

  it('returns undefined for unknown plugin', () => {
    assert.equal(this.connection.results.get('no_such_plugin'), undefined)
  })
})

describe('get_all', () => {
  it('returns the full store', () => {
    this.connection.results.add('plugin_a', { pass: 'ok' })
    this.connection.results.add('plugin_b', { fail: 'bad' })
    const all = this.connection.results.get_all()
    assert.ok(all.plugin_a)
    assert.ok(all.plugin_b)
    assert.deepEqual(all.plugin_a.pass, ['ok'])
    assert.deepEqual(all.plugin_b.fail, ['bad'])
  })

  it('returns empty object when no results stored', () => {
    const all = this.connection.results.get_all()
    assert.equal(Object.keys(all).length, 0)
    assert.equal(Object.getPrototypeOf(all), null)
  })
})

describe('collate', () => {
  it('formats pass list as string', () => {
    this.connection.results.add({ name: 'pi' }, { pass: 'goob' })
    assert.equal(this.connection.results.collate('pi'), 'pass:goob')
  })

  it('returns undefined for unknown plugin', () => {
    assert.equal(this.connection.results.collate('no_such_plugin'), undefined)
  })
})

describe('incr', () => {
  it('initializes and increments a counter', () => {
    this.connection.results.incr('test_plugin', { counter: 1 })
    assert.equal(this.connection.results.get('test_plugin').counter, 1)
  })

  it('accumulates across multiple calls', () => {
    this.connection.results.incr('test_plugin', { counter: 1 })
    this.connection.results.incr('test_plugin', { counter: 2 })
    this.connection.results.incr('test_plugin', { counter: 0.5 })
    assert.equal(this.connection.results.get('test_plugin').counter, 3.5)
  })

  it('treats non-numeric values as 0', () => {
    this.connection.results.incr('test_plugin', { counter: 'banana' })
    assert.equal(this.connection.results.get('test_plugin').counter, 0)
  })

  it('resets NaN existing value to 0 before adding', () => {
    this.connection.results.add('test_plugin', { x: 'not-a-number' })
    this.connection.results.incr('test_plugin', { x: 5 })
    assert.equal(this.connection.results.get('test_plugin').x, 5)
  })
})

describe('resolve_plugin_name', () => {
  it('returns string unchanged', () => {
    assert.equal(
      this.connection.results.resolve_plugin_name('test_plugin'),
      'test_plugin',
    )
  })

  it('returns name property from object', () => {
    assert.equal(
      this.connection.results.resolve_plugin_name({ name: 'test_plugin' }),
      'test_plugin',
    )
  })

  it('returns undefined for null', () => {
    assert.equal(this.connection.results.resolve_plugin_name(null), undefined)
  })

  it('returns undefined for object without name', () => {
    assert.equal(this.connection.results.resolve_plugin_name({}), undefined)
  })
})

describe('_log return value', () => {
  it('add returns the human-readable collation string', () => {
    const human = this.connection.results.add('test_plugin', { pass: 'ok' })
    assert.equal(typeof human, 'string')
    assert.ok(human.includes('ok'))
  })

  it('push returns the human-readable collation string', () => {
    const human = this.connection.results.push('test_plugin', {
      pass: 'pushed',
    })
    assert.equal(typeof human, 'string')
    assert.ok(human.includes('pushed'))
  })

  it('uses caller-supplied human verbatim', () => {
    const human = this.connection.results.add('test_plugin', {
      pass: 'ok',
      human: 'caller said so',
    })
    assert.equal(human, 'caller said so')
  })

  it('emits loginfo when obj.emit is set', () => {
    const infos = []
    this.connection.loginfo = (_plugin, msg) => infos.push(msg)
    this.connection.results.add('test_plugin', { pass: 'announce', emit: true })
    assert.equal(infos.length, 1)
    assert.ok(/announce/.test(infos[0]), `unexpected: ${infos[0]}`)
  })

  it('logs debug when config has debug=1', () => {
    const debugs = []
    this.connection.logdebug = (_plugin, msg) => debugs.push(msg)
    this.connection.results.add('karma', { pass: 'p' })
    assert.equal(debugs.length, 1)
  })
})

describe('add arbitrary keys', () => {
  it('stores a plain arbitrary key', () => {
    this.connection.results.add('test_plugin', { score: 42 })
    assert.equal(this.connection.results.get('test_plugin').score, 42)
  })

  it('skips arbitrary keys with undefined value', () => {
    this.connection.results.add('test_plugin', { score: undefined })
    assert.equal('score' in this.connection.results.get('test_plugin'), false)
  })

  it('ignores __proto__ to prevent prototype pollution', () => {
    // Object-literal __proto__ syntax sets the literal's prototype rather
    // than an own property, so it never hits Object.entries. Use JSON.parse
    // to produce a genuine enumerable own property — the real attack shape.
    const payload = JSON.parse('{"__proto__":{"pwned":true}}')
    this.connection.results.add('test_plugin', payload)
    const result = this.connection.results.get('test_plugin')
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.pwned, undefined)
    assert.equal({}.pwned, undefined)
  })

  it('ignores constructor key', () => {
    this.connection.results.add('test_plugin', { constructor: 'evil' })
    assert.notEqual(
      this.connection.results.get('test_plugin').constructor,
      'evil',
    )
  })

  it('ignores prototype key', () => {
    this.connection.results.add('test_plugin', { prototype: 'evil' })
    assert.equal(
      this.connection.results.get('test_plugin').prototype,
      undefined,
    )
  })

  it('push ignores __proto__', () => {
    const payload = JSON.parse('{"__proto__":{"pwned":true}}')
    this.connection.results.push('test_plugin', payload)
    const result = this.connection.results.get('test_plugin')
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.pwned, undefined)
  })

  it('incr ignores __proto__', () => {
    const payload = JSON.parse('{"__proto__":{"pwned":true}}')
    this.connection.results.incr('test_plugin', payload)
    const result = this.connection.results.get('test_plugin')
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.pwned, undefined)
  })

  it('add with unsafe plugin name does not corrupt store prototype', () => {
    this.connection.results.add('__proto__', { score: 1 })
    assert.equal({}.score, undefined)
  })
})

describe('add falsy predefined values', () => {
  it('stores pass: 0', () => {
    this.connection.results.add('test_plugin', { pass: 0 })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, [0])
  })

  it('stores pass: false', () => {
    this.connection.results.add('test_plugin', { pass: false })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, [false])
  })

  it('stores msg: empty string', () => {
    this.connection.results.add('test_plugin', { msg: '' })
    assert.deepEqual(this.connection.results.get('test_plugin').msg, [''])
  })

  it('skips pass: undefined (does not append)', () => {
    this.connection.results.add('test_plugin', { pass: undefined })
    assert.deepEqual(this.connection.results.get('test_plugin').pass, [])
  })

  it('skips order: undefined (does not overwrite)', () => {
    this.connection.results.add('test_plugin', { order: ['a'] })
    this.connection.results.add('test_plugin', { order: undefined })
    assert.deepEqual(this.connection.results.get('test_plugin').order, ['a'])
  })
})

describe('redis_publish error handling', () => {
  it('no-op when conn.server.notes.redis is missing', () => {
    this.connection.results.redis_publish('pi', { pass: 'x' })
  })

  it('catches publish rejection and logs an error', async () => {
    const server = {
      notes: {
        redis: {
          publish: () => Promise.reject(new Error('boom')),
        },
      },
    }
    const conn = fixtures.connection.createConnection({}, server)
    const errors = []
    conn.logerror = (_plugin, msg) => errors.push(msg)
    conn.results = new Results(conn)

    conn.results.add({ name: 'pi' }, { pass: 'the test' })

    await new Promise((resolve) => setImmediate(resolve))
    assert.ok(
      errors.some((m) => /redis publish failed: boom/.test(m)),
      `expected logerror; got ${JSON.stringify(errors)}`,
    )
  })

  it('catches non-Error rejection from publish', async () => {
    const server = {
      notes: {
        redis: {
          publish: () => Promise.reject('plain-string-reason'),
        },
      },
    }
    const conn = fixtures.connection.createConnection({}, server)
    const errors = []
    conn.logerror = (_plugin, msg) => errors.push(msg)
    conn.results = new Results(conn)

    conn.results.add({ name: 'pi' }, { pass: 'x' })

    await new Promise((resolve) => setImmediate(resolve))
    assert.ok(
      errors.some((m) => /plain-string-reason/.test(m)),
      `expected logerror; got ${JSON.stringify(errors)}`,
    )
  })
})

describe('redis_publish', () => {
  it('publishes result over redis', async () => {
    let redis
    try {
      redis = require('redis')
    } catch {
      return // redis optional dep not installed, skip
    }

    const server = { notes: { redis: redis.createClient() } }
    await server.notes.redis.connect()

    const conn = fixtures.connection.createConnection({}, server)
    conn.results = new Results(conn)

    const sub_db = redis.createClient()
    await sub_db.connect()

    await new Promise((resolve) => {
      sub_db.pSubscribe('*', (message) => {
        assert.equal(JSON.parse(message).result.pass, 'the test')
        server.notes.redis.quit()
        sub_db.quit()
        resolve()
      })
      conn.results.add({ name: 'pi' }, { pass: 'the test' })
    })
  })
})
