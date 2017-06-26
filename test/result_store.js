
var fixtures     = require('haraka-test-fixtures');
var Results      = require('../index');

function _set_up (done) {
    this.connection = new fixtures.connection.createConnection();
    this.connection.results = new Results(this.connection);
    done();
}

exports.default_result = {
    setUp : _set_up,
    // tearDown : _tear_down,
    'init add' : function (test) {
        test.expect(1);
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual(
            { pass: ['test pass'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
        test.done();
    },
    'init add array' : function (test) {
        test.expect(1);
        this.connection.results.add('test_plugin', { pass: 1 });
        this.connection.results.add('test_plugin', { pass: [2,3] });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual(
            { pass: [1,2,3], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
        test.done();
    },
    'init incr' : function (test) {
        test.expect(1);
        this.connection.results.incr('test_plugin', { counter: 1 });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual(
            { pass: [], fail: [], msg: [], err: [], skip: [], counter: 1 },
            this.connection.results.get('test_plugin')
        );
        test.done();
    },
    'init push' : function (test) {
        test.expect(1);
        this.connection.results.push('test_plugin', { pass: 'test1' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual(
            { pass: ['test1'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
        test.done();
    },
    'init push array' : function (test) {
        test.expect(1);
        this.connection.results.push('test_plugin', { pass: 'test1' });
        this.connection.results.push('test_plugin', { pass: ['test2'] });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual(
            { pass: ['test1','test2'], fail: [], msg: [], err: [], skip: [] },
            this.connection.results.get('test_plugin')
        );
        test.done();
    },
    'init push, other' : function (test) {
        test.expect(1);
        this.connection.results.push('test_plugin', { other: 'test2' });
        delete this.connection.results.store.test_plugin.human;
        delete this.connection.results.store.test_plugin.human_html;
        test.deepEqual({
            pass: [], other: ['test2'], fail: [], msg: [],
            err: [], skip: []
        },
        this.connection.results.get('test_plugin')
        );
        test.done();
    },
};

exports.has = {
    setUp : _set_up,
    'has, list, string' : function (test) {
        test.expect(2);
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        test.equal(true, this.connection.results.has('test_plugin', 'pass', 'test pass'));
        test.equal(false, this.connection.results.has('test_plugin', 'pass', 'test miss'));
        test.done();
    },
    'has, list, number' : function (test) {
        test.expect(2);
        this.connection.results.add('test_plugin', { msg: 1 });
        test.equal(true, this.connection.results.has('test_plugin', 'msg', 1));
        test.equal(false, this.connection.results.has('test_plugin', 'msg', 2));
        test.done();
    },
    'has, list, boolean' : function (test) {
        test.expect(2);
        this.connection.results.add('test_plugin', { msg: true });
        test.equal(true, this.connection.results.has('test_plugin', 'msg', true));
        test.equal(false, this.connection.results.has('test_plugin', 'msg', false));
        test.done();
    },
    'has, list, regexp' : function (test) {
        test.expect(3);
        this.connection.results.add('test_plugin', { pass: 'test pass' });
        test.ok(this.connection.results.has('test_plugin', 'pass', /test/));
        test.ok(this.connection.results.has('test_plugin', 'pass', / pass/));
        test.equal(this.connection.results.has('test_plugin', 'pass', /not/), false);
        test.done();
    },
    'has, string, string' : function (test) {
        test.expect(2);
        this.connection.results.add('test_plugin', { random_key: 'string value' });
        test.ok(this.connection.results.has('test_plugin', 'random_key', 'string value'));
        test.equal(false, this.connection.results.has('test_plugin', 'random_key', 'strings'));
        test.done();
    },
    'has, string, regex' : function (test) {
        test.expect(3);
        this.connection.results.add('test_plugin', { random_key: 'string value' });
        test.ok(this.connection.results.has( 'test_plugin', 'random_key', /string/));
        test.ok(this.connection.results.has( 'test_plugin', 'random_key', /value/));
        test.equal(false, this.connection.results.has('test_plugin', 'random_key', /miss/));
        test.done();
    },
};

exports.private_collate = {
    setUp : _set_up,
    'collate, arrays are shown in output' : function (test) {
        test.expect(2);
        this.connection.results.push('test_plugin', { foo: 'bar' });
        // console.log(this.connection.results);
        test.equal(true, this.connection.results.has('test_plugin', 'foo', /bar/));
        test.ok(/bar/.test(this.connection.results.get('test_plugin').human));
        test.done();
    },
};

exports.get = {
    setUp : function (done) {
        this.connection = new fixtures.connection.createConnection();
        this.connection.results.add('test_plugin', { pass: 'foo' });
        done();
    },
    'has, plugin' : function (test) {
        test.expect(1);
        var cr = this.connection.results.get({ name: 'test_plugin' });
        test.equal('foo', cr.pass[0]);
        test.done();
    },
    'has, plugin name' : function (test) {
        test.expect(1);
        var cr = this.connection.results.get('test_plugin');
        test.equal('foo', cr.pass[0]);
        test.done();
    },
};

exports.collate = {
    setUp : _set_up,
    'string' : function (test) {
        test.expect(1);
        this.connection.results.add({name: 'pi'}, { pass: 'goob' });
        var collated = this.connection.results.collate('pi');
        test.equal('pass:goob', collated);
        test.done();
    },
}

exports.resolve_plugin_name = {
    setUp : _set_up,
    'string' : function (test) {
        test.expect(1);
        var name = this.connection.results.resolve_plugin_name('test_plugin');
        test.equal('test_plugin', name);
        test.done();
    },
    'object' : function (test) {
        test.expect(1);
        var name = this.connection.results.resolve_plugin_name({ name: 'test_plugin' });
        test.equal('test_plugin', name);
        test.done();
    },
}

exports.redis_publish = {
    setUp : function (done) {
        var server = {
            notes: {
                // this is the redis that will publish
                redis: require('redis').createClient(),
            }
        };
        this.connection = new fixtures.connection.createConnection(null, server);
        this.connection.results = new Results(this.connection);
        done();
    },
    'redis_publish' : function (test) {
        var conn = this.connection;
        test.expect(1);

        // this redis client is subscribed
        var sub_db = require('redis').createClient();
        sub_db.on('pmessage', function (pattern, channel, message) {
            // console.log(arguments);
            test.equal(JSON.parse(message).result.pass, 'the test');
            test.done();
        })
            .on('psubscribe', function (pattern, count) {
            // console.log('psubscribed to ' + pattern);
                conn.results.add({ name: 'pi'}, { pass: 'the test'});
            })
            .psubscribe('*');
    },
}
