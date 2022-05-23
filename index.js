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

class ResultStore {
    constructor (conn) {
        this.conn = conn;
        this.store = {};
        cfg = config.get('results.ini', {
            booleans: [
                '+main.redis_publish',
            ]
        });
    }

    has (plugin, list, search) {
        const name = this.resolve_plugin_name(plugin);
        const result = this.store[name];
        if (!result || !result[list]) return false;

        if (typeof result[list] === 'string') {
            return this._has_string(result[list], search);
        }

        if (Array.isArray(result[list])) {
            return this._has_array(result[list], search);
        }

        return false;
    }

    _has_string (msg, search) {
        if (typeof search === 'string' && search === msg) return true;
        if (typeof search === 'object' && msg.match(search)) return true;
        return false;
    }

    _has_array (msg, search) {
        for (const item of msg) {
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
        return false;
    }

    redis_publish (name, obj) {
        if (!cfg.main.redis_publish) return;
        if (!this.conn.server || !this.conn.server.notes) return;
        if (!this.conn.server.notes.redis) return;

        const channel = `result-${this.conn.transaction ? this.conn.transaction.uuid : this.conn.uuid}`;
        this.conn.server.notes.redis.publish(channel, JSON.stringify({ plugin: name, result: obj }));
    }

    add (plugin, obj) {
        const name = this.resolve_plugin_name(plugin);
        let result = this.store[name];
        if (!result) {
            result = default_result();
            this.store[name] = result;
        }

        this.redis_publish(name, obj);

        // these are arrays each invocation appends to
        for (const key of append_lists) {
            if (!obj[key]) continue;
            result[key] = this._append_to_array(result[key], obj[key])
        }

        // these arrays are overwritten when passed
        for (const key of overwrite_lists) {
            if (!obj[key]) continue;
            result[key] = obj[key];
        }

        // anything else is an arbitrary key/val to store
        for (const key in obj) {
            if (all_opts.indexOf(key) !== -1) continue; // weed out our keys
            result[key] = obj[key];            // save the rest
        }

        return this._log(plugin, result, obj);
    }

    _append_to_array (array, item) {
        if (Array.isArray(item)) return array.concat(item);

        array.push(item);
        return array;
    }

    incr (plugin, obj) {
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
    }

    push (plugin, obj) {
        const name = this.resolve_plugin_name(plugin);
        let result = this.store[name];
        if (!result) {
            result = default_result();
            this.store[name] = result;
        }

        this.redis_publish(name, obj);

        for (const key in obj) {
            if (!result[key]) result[key] = [];
            result[key] = this._append_to_array(result[key], obj[key])
        }

        return this._log(plugin, result, obj);
    }

    collate (plugin) {
        const name = this.resolve_plugin_name(plugin);
        const result = this.store[name];
        if (!result) return;
        return this.private_collate(result, name).join(', ');
    }

    get (plugin_or_name) {
        return this.store[ this.resolve_plugin_name(plugin_or_name) ];
    }

    resolve_plugin_name (thing) {
        if (typeof thing === 'string')               return thing;
        if (typeof thing === 'object' && thing.name) return thing.name;
        return;
    }

    get_all () {
        return this.store;
    }

    private_collate (result, name) {
        const r = [];

        const order = this._get_order(cfg[name]);
        const hide = this._get_hide(cfg[name]);

        // anything not predefined in the result was purposeful, show it first
        for (const key in result) {
            if (!this._pre_defined(key, result[key], hide)) continue;
            r.push(`${key}: ${result[key]}`);
        }

        // and then supporting information
        let array = append_lists;                   // default
        if (order && order.length) array = order;   // config file
        if (result.order && result.order.length) array = result.order; // caller

        for (const key of array) {
            if (!result[key]) continue;
            if (!result[key].length) continue;
            if (hide && hide.length && hide.indexOf(key) !== -1) continue;
            r.push(`${key}:${result[key].join(', ')}`);
        }

        return r;
    }

    _pre_defined (key, res, hide) {
        if (key[0] === '_') return false;  // 'private' keys
        if (all_opts.indexOf(key) !== -1) return false;  // these get shown later.
        if (hide.length && hide.indexOf(key) !== -1) return false;
        if (typeof res === 'object') {
            if (Array.isArray(res)) {
                if (res.length === 0) return false;
            }
            else {
                return false;
            }
        }
        return true;
    }

    _get_order (c) {
        if (!c || !c.order) return [];
        return c.order.trim().split(/[,; ]+/);
    }

    _get_hide (c) {
        if (!c || !c.hide) return [];
        return c.hide.trim().trim().split(/[,; ]+/);
    }

    _log (plugin, result, obj) {
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
    }
}

function default_result () {
    return { pass: [], fail: [], msg: [], err: [], skip: [] };
}

module.exports = ResultStore;
