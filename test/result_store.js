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
    assert.deepEqual(this.connection.results.get('test_plugin').other, ['test2'])
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
    assert.deepEqual(this.connection.results.get('test_plugin').err, ['plain error'])
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
    assert.equal(this.connection.results.has('test_plugin', 'msg', false), false)
  })

  it('has, list, regexp', () => {
    this.connection.results.add('test_plugin', { pass: 'test pass' })
    assert.ok(this.connection.results.has('test_plugin', 'pass', /test/))
    assert.ok(this.connection.results.has('test_plugin', 'pass', / pass/))
    assert.equal(this.connection.results.has('test_plugin', 'pass', /not/), false)
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
    assert.ok(this.connection.results.has('test_plugin', 'random_key', /string/))
    assert.ok(this.connection.results.has('test_plugin', 'random_key', /value/))
    assert.equal(
      this.connection.results.has('test_plugin', 'random_key', /miss/),
      false,
    )
  })

  it('returns false for unknown plugin', () => {
    assert.equal(this.connection.results.has('no_such_plugin', 'pass', 'x'), false)
  })

  it('returns false for unknown list on known plugin', () => {
    this.connection.results.add('test_plugin', { pass: 'foo' })
    assert.equal(
      this.connection.results.has('test_plugin', 'no_such_list', 'foo'),
      false,
    )
  })
})

describe('private_collate', () => {
  it('arrays are shown in output', () => {
    this.connection.results.push('test_plugin', { foo: 'bar' })
    assert.equal(this.connection.results.has('test_plugin', 'foo', /bar/), true)
    assert.ok(/bar/.test(this.connection.results.get('test_plugin').human))
  })
})

describe('get', () => {
  beforeEach(() => {
    this.connection = fixtures.connection.createConnection()
    this.connection.results = new Results(this.connection)
    this.connection.results.add('test_plugin', { pass: 'foo' })
  })

  it('by plugin object', () => {
    assert.equal(this.connection.results.get({ name: 'test_plugin' }).pass[0], 'foo')
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
    assert.deepEqual(this.connection.results.get_all(), {})
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
    const human = this.connection.results.push('test_plugin', { pass: 'pushed' })
    assert.equal(typeof human, 'string')
    assert.ok(human.includes('pushed'))
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
