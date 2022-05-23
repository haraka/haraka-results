
const assert    = require('assert')

const redis     = require('redis')

const fixtures  = require('haraka-test-fixtures');
const Results   = require('../index');

beforeEach(async function () {
    this.connection = new fixtures.connection.createConnection()
    this.connection.results = new Results(this.connection)
})

describe('default_result', function () {

    it('init add', async function () {
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual(
            { pass: ['test pass'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        )
    })

    it('init add array', async function () {
        this.connection.results.add('test_plugin', { pass: 1 });
        this.connection.results.add('test_plugin', { pass: [2,3] });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual(
            { pass: [1,2,3], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
    })

    it('init incr', async function () {
        this.connection.results.incr('test_plugin', { counter: 1 });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual(
            { pass: [], fail: [], msg: [], err: [], skip: [], counter: 1 },
            this.connection.results.get('test_plugin')
        );
    })

    it('init push', async function () {
        this.connection.results.push('test_plugin', { pass: 'test1' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual(
            { pass: ['test1'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
    })

    it('init push array', async function () {
        this.connection.results.push('test_plugin', { pass: 'test1' });
        this.connection.results.push('test_plugin', { pass: ['test2'] });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual(
            { pass: ['test1','test2'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
    })

    it('init push, other', async function () {
        this.connection.results.push('test_plugin', { other: 'test2' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        assert.deepEqual({
            pass: [], other: ['test2'], fail: [], msg: [],
            err: [], skip: []
        },
        this.connection.results.get('test_plugin')
        );
    })

})

describe('has', () => {
    it('has, list, string', async function () {
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        assert.equal(true, this.connection.results.has('test_plugin', 'pass', 'test pass'));
        assert.equal(false, this.connection.results.has('test_plugin', 'pass', 'test miss'));
    })

    it('has, list, number', async function () {
        this.connection.results.add('test_plugin', { msg: 1 });
        assert.equal(true, this.connection.results.has('test_plugin', 'msg', 1));
        assert.equal(false, this.connection.results.has('test_plugin', 'msg', 2));
    })

    it('has, list, boolean', async function () {
        this.connection.results.add('test_plugin', { msg: true });
        assert.equal(true, this.connection.results.has('test_plugin', 'msg', true));
        assert.equal(false, this.connection.results.has('test_plugin', 'msg', false));
    })

    it('has, list, regexp', async function () {
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        assert.ok(this.connection.results.has('test_plugin', 'pass', /test/));
        assert.ok(this.connection.results.has('test_plugin', 'pass', / pass/));
        assert.equal(this.connection.results.has('test_plugin', 'pass', /not/), false);
    })
    it('has, string, string', async function () {
        this.connection.results.add('test_plugin', { random_key: 'string value' });
        assert.ok(this.connection.results.has('test_plugin', 'random_key', 'string value'));
        assert.equal(false, this.connection.results.has('test_plugin', 'random_key', 'strings'));
    })
    it('has, string, regex', async function () {
        this.connection.results.add('test_plugin', { random_key: 'string value' });
        assert.ok(this.connection.results.has( 'test_plugin', 'random_key', /string/));
        assert.ok(this.connection.results.has( 'test_plugin', 'random_key', /value/));
        assert.equal(false, this.connection.results.has('test_plugin', 'random_key', /miss/));
    })
})

describe('private_collate', () => {
    it('collate, arrays are shown in output', async function () {
        this.connection.results.push('test_plugin', { foo: 'bar' });
        // console.log(this.connection.results);
        assert.equal(true, this.connection.results.has('test_plugin', 'foo', /bar/));
        assert.ok(/bar/.test(this.connection.results.get('test_plugin').human));
    })
})

describe('get', () => {
    beforeEach(async function () {
        this.connection = new fixtures.connection.createConnection()
        this.connection.results.add('test_plugin', { pass: 'foo' })
    })

    it('has, plugin', async function () {
        const cr = this.connection.results.get({ name: 'test_plugin' });
        assert.equal('foo', cr.pass[0]);
    })

    it('has, plugin name', async function () {
        const cr = this.connection.results.get('test_plugin');
        assert.equal('foo', cr.pass[0]);
    })
})

describe('collate', () => {
    it('string', async function () {
        this.connection.results.add({name: 'pi'}, { pass: 'goob' });
        const collated = this.connection.results.collate('pi');
        assert.equal('pass:goob', collated);
    })
})

describe('resolve_plugin_name', () => {

    it('string', async function () {
        const name = this.connection.results.resolve_plugin_name('test_plugin');
        assert.equal('test_plugin', name);
    })

    it('object', async function () {
        const name = this.connection.results.resolve_plugin_name({ name: 'test_plugin' });
        assert.equal('test_plugin', name);
    })
})

describe('redis_publish', () => {

    beforeEach(async function () {
        const server = {
            notes: {
                // this is the redis that will publish
                redis: require('redis').createClient(),
            }
        };
        await server.notes.redis.connect()
        this.connection = new fixtures.connection.createConnection(null, server);
        this.connection.results = new Results(this.connection);
    })

    it('redis_publish', async function () {
        const conn = this.connection;

        const sub_db = redis.createClient()

        await sub_db.connect()

        await sub_db.pSubscribe('*', (message, channel) => {
            assert.equal(JSON.parse(message).result.pass, 'the test');
            conn.server.notes.redis.quit()
            sub_db.quit()
        })

        conn.results.add({ name: 'pi'}, { pass: 'the test'})
    })
})
