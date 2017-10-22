// results - programmatic handling of plugin results

'use strict';

const config = require('haraka-config');
const util   = require('util');

// see docs in docs/Results.md
const append_lists = ['msg','pass','fail','skip','err'];
const overwrite_lists = ['hide','order'];
const log_opts     = ['emit','human','human_html'];
const all_opts     = append_lists.concat(overwrite_lists, log_opts);
let cfg;

function ResultStore (conn) {
    this.conn = conn;
    this.store = {};
    cfg = config.get('results.ini', {
        booleans: [
            '+main.redis_publish',
        ]
    });
}

function default_result () {
    return { pass: [], fail: [], msg: [], err: [], skip: [] };
}

ResultStore.prototype.has = function (plugin, list, search) {
    const name = this.resolve_plugin_name(plugin);
    const result = this.store[name];
    if (!result) return false;
    if (!result[list]) return false;
    if (typeof result[list] === 'string') {
        if (typeof search === 'string' && search === result[list]) return true;
        if (typeof search === 'object' && result[list].match(search)) {
            return true;
        }
        return false;
    }
    if (Array.isArray(result[list])) {
        for (let i=0; i<result[list].length; i++) {
            const item = result[list][i];
            switch (typeof search) {
                case 'string':
                case 'number':
                case 'boolean':
                    if (search === item) return true;
                    break;
                case 'object':
                    if (item.match(search)) return true;
                    break;
            }
        }
    }
    return false;
};

ResultStore.prototype.redis_publish = function (name, obj) {
    if (!cfg.main.redis_publish) return;
    if (!this.conn.server || !this.conn.server.notes) return;
    if (!this.conn.server.notes.redis) return;

    const channel = `result-${this.conn.transaction ? this.conn.transaction.uuid : this.conn.uuid}`;

    this.conn.server.notes.redis.publish(channel,
        JSON.stringify({ plugin: name, result: obj }));
};

ResultStore.prototype.add = function (plugin, obj) {
    const name = this.resolve_plugin_name(plugin);
    let result = this.store[name];
    if (!result) {
        result = default_result();
        this.store[name] = result;
    }

    this.redis_publish(name, obj);

    // these are arrays each invocation appends to
    for (let i=0; i < append_lists.length; i++) {
        const key = append_lists[i];
        if (!obj[key]) continue;
        if (Array.isArray(obj[key])) {
            result[key] = result[key].concat(obj[key]);
        }
        else {
            result[key].push(obj[key]);
        }
    }

    // these arrays are overwritten when passed
    for (let j=0; j < overwrite_lists.length; j++) {
        const key = overwrite_lists[j];
        if (!obj[key]) continue;
        result[key] = obj[key];
    }

    // anything else is an arbitrary key/val to store
    for (const key in obj) {
        if (all_opts.indexOf(key) !== -1) continue; // weed out our keys
        result[key] = obj[key];            // save the rest
    }

    return this._log(plugin, result, obj);
};

ResultStore.prototype.incr = function (plugin, obj) {
    const name = this.resolve_plugin_name(plugin);
    let result = this.store[name];
    if (!result) {
        result = default_result();
        this.store[name] = result;
    }

    const pub = {};

    for (const key in obj) {
        let val = parseFloat(obj[key]) || 0;
        if (isNaN(val)) val = 0;
        if (isNaN(result[key])) result[key] = 0;
        result[key] = parseFloat(result[key]) + parseFloat(val);
        pub[key] = result[key];
    }

    this.redis_publish(name, pub);
};

ResultStore.prototype.push = function (plugin, obj) {
    const name = this.resolve_plugin_name(plugin);
    let result = this.store[name];
    if (!result) {
        result = default_result();
        this.store[name] = result;
    }

    this.redis_publish(name, obj);

    for (const key in obj) {
        if (!result[key]) result[key] = [];
        if (Array.isArray(obj[key])) {
            result[key] = result[key].concat(obj[key]);
        }
        else {
            result[key].push(obj[key]);
        }
    }

    return this._log(plugin, result, obj);
};

ResultStore.prototype.collate = function (plugin) {
    const name = this.resolve_plugin_name(plugin);
    const result = this.store[name];
    if (!result) return;
    return this.private_collate(result, name).join(', ');
};

ResultStore.prototype.get = function (plugin_or_name) {
    const name = this.resolve_plugin_name(plugin_or_name);
    return this.store[name];
};

ResultStore.prototype.resolve_plugin_name = function (thing) {
    if (typeof thing === 'string')               return thing;
    if (typeof thing === 'object' && thing.name) return thing.name;
    return;
};

ResultStore.prototype.get_all = function () {
    return this.store;
};

ResultStore.prototype.private_collate = function (result, name) {
    const r = [];
    let order = [];
    let hide = [];

    if (cfg[name]) {
        if (cfg[name].hide)  hide  = cfg[name].hide.trim().split(/[,; ]+/);
        if (cfg[name].order) order = cfg[name].order.trim().split(/[,; ]+/);
    }

    // anything not predefined in the result was purposeful, show it first
    for (const key in result) {
        if (key[0] === '_') continue;  // ignore 'private' keys
        if (all_opts.indexOf(key) !== -1) continue;  // these get shown later.
        if (hide.length && hide.indexOf(key) !== -1) continue;
        if (typeof result[key] === 'object') {
            if (Array.isArray(result[key])) {
                if (result[key].length === 0) continue;
            }
            else {
                continue;
            }
        }
        r.push(`${key}: ${result[key]}`);
    }

    // and then supporting information
    let array = append_lists;                   // default
    if (order && order.length) array = order;   // config file
    if (result.order && result.order.length) array = result.order; // caller

    for (let i=0; i < array.length; i++) {
        const key = array[i];
        if (!result[key]) continue;
        if (!result[key].length) continue;
        if (hide && hide.length && hide.indexOf(key) !== -1) continue;
        r.push( `${key}: ${result[key].join(', ')}`);
    }

    return r;
};

ResultStore.prototype._log = function (plugin, result, obj) {
    const name = plugin.name;

    // collate results
    result.human = obj.human;
    if (!result.human) {
        const r = this.private_collate(result, name);
        result.human = r.join(', ');
        result.human_html = r.join(', \t ');
    }

    // logging results
    if (obj.emit) this.conn.loginfo(plugin, result.human);  // by request
    if (obj.err) {
        // Handle error objects by logging the message
        if (util.isError(obj.err)) {
            this.conn.logerror(plugin, obj.err.message);
        }
        else {
            this.conn.logerror(plugin, obj.err);
        }
    }
    if (!obj.emit && !obj.err) {                            // by config
        const pic = cfg[name];
        if (pic && pic.debug) this.conn.logdebug(plugin, result.human);
    }
    return this.human;
};

module.exports = ResultStore;
