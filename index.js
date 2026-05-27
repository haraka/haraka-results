// results - programmatic handling of plugin results
'use strict'

const config = require('haraka-config')
const { types } = require('node:util')

// see docs in docs/Results.md
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const append_lists = ['msg', 'pass', 'fail', 'skip', 'err']
const overwrite_lists = ['hide', 'order']
const log_opts = ['emit', 'human', 'human_html']
const all_opts = [...append_lists, ...overwrite_lists, ...log_opts]
let cfg

class ResultStore {
  constructor(conn) {
    this.conn = conn
    this.store = Object.create(null)
    cfg = config.get('results.ini', {
      booleans: ['+main.redis_publish'],
    })
  }

  has(plugin, list, search) {
    const name = this.resolve_plugin_name(plugin)
    const result = this.store[name]
    if (!result || !result[list]) return false

    if (typeof result[list] === 'string') {
      return this._has_string(result[list], search)
    }

    if (Array.isArray(result[list])) {
      return this._has_array(result[list], search)
    }

    return false
  }

  _has_string(msg, search) {
    if (typeof search === 'string') return search === msg
    if (search instanceof RegExp) return search.test(msg)
    return false
  }

  _has_array(msg, search) {
    for (const item of msg) {
      switch (typeof search) {
        case 'string':
        case 'number':
        case 'boolean':
          if (search === item) return true
          break
        case 'object':
          if (search instanceof RegExp && search.test(item)) return true
          break
      }
    }
    return false
  }

  redis_publish(name, obj) {
    if (!cfg.main.redis_publish) return
    if (!this.conn.server?.notes?.redis) return

    const channel = `result-${this.conn.transaction?.uuid ?? this.conn.uuid}`
    this.conn.server.notes.redis
      .publish(channel, JSON.stringify({ plugin: name, result: obj }))
      .catch((err) => {
        const msg = err?.message ?? String(err)
        this.conn.logerror('results', `redis publish failed: ${msg}`)
      })
  }

  add(plugin, obj) {
    const name = this.resolve_plugin_name(plugin)
    const result = this._get_or_create(name)

    this.redis_publish(name, obj)
    this._merge_appends(result, obj)
    this._merge_overwrites(result, obj)
    this._merge_arbitrary(result, obj)

    return this._log(plugin, result, obj)
  }

  _get_or_create(name) {
    let result = this.store[name]
    if (!result) {
      result = default_result()
      this.store[name] = result
    }
    return result
  }

  _unpack_err(val) {
    if (Array.isArray(val)) {
      return val.map((e) => (types.isNativeError(e) ? e.message : e))
    }
    if (types.isNativeError(val)) return val.message
    return val
  }

  _merge_appends(result, obj) {
    for (const key of append_lists) {
      if (!Object.hasOwn(obj, key)) continue
      let val = obj[key]
      if (val === undefined) continue
      if (key === 'err') val = this._unpack_err(val)
      result[key] = this._append_to_array(result[key], val)
    }
  }

  _merge_overwrites(result, obj) {
    for (const key of overwrite_lists) {
      if (!Object.hasOwn(obj, key)) continue
      if (obj[key] === undefined) continue
      result[key] = obj[key]
    }
  }

  _merge_arbitrary(result, obj) {
    for (const [key, val] of Object.entries(obj)) {
      if (all_opts.includes(key)) continue
      if (UNSAFE_KEYS.has(key)) continue
      if (val === undefined) continue
      result[key] = val
    }
  }

  _append_to_array(array, item) {
    if (Array.isArray(item)) return array.concat(item)
    array.push(item)
    return array
  }

  incr(plugin, obj) {
    const name = this.resolve_plugin_name(plugin)
    const result = this._get_or_create(name)

    const pub = {}

    for (const [key, raw] of Object.entries(obj)) {
      if (UNSAFE_KEYS.has(key)) continue
      const val = parseFloat(raw) || 0
      if (isNaN(result[key])) result[key] = 0
      result[key] = parseFloat(result[key]) + val
      pub[key] = result[key]
    }

    this.redis_publish(name, pub)
  }

  push(plugin, obj) {
    const name = this.resolve_plugin_name(plugin)
    const result = this._get_or_create(name)

    this.redis_publish(name, obj)

    for (const [key, val] of Object.entries(obj)) {
      if (UNSAFE_KEYS.has(key)) continue
      if (!result[key]) result[key] = []
      result[key] = this._append_to_array(result[key], val)
    }

    return this._log(plugin, result, obj)
  }

  collate(plugin) {
    const name = this.resolve_plugin_name(plugin)
    const result = this.store[name]
    if (!result) return
    return this.private_collate(result, name).join(', ')
  }

  get(plugin_or_name) {
    return this.store[this.resolve_plugin_name(plugin_or_name)]
  }

  resolve_plugin_name(thing) {
    if (typeof thing === 'string') return thing
    if (typeof thing === 'object' && thing?.name) return thing.name
    return
  }

  get_all() {
    return this.store
  }

  private_collate(result, name) {
    const r = []

    const order = this._get_order(cfg[name])
    const hide = this._get_hide(cfg[name])

    // anything not predefined in the result was purposeful, show it first
    for (const key in result) {
      if (!this._pre_defined(key, result[key], hide)) continue
      r.push(`${key}: ${result[key]}`)
    }

    // and then supporting information
    let array = append_lists // default
    if (order.length) array = order // config file
    if (result.order?.length) array = result.order // caller

    for (const key of array) {
      if (!result[key]) continue
      if (!result[key].length) continue
      if (hide.length && hide.includes(key)) continue
      r.push(`${key}:${result[key].join(', ')}`)
    }

    return r
  }

  _pre_defined(key, res, hide) {
    if (key[0] === '_') return false
    if (all_opts.includes(key)) return false
    if (hide.length && hide.includes(key)) return false
    if (Array.isArray(res)) return res.length > 0
    if (typeof res === 'object') return false
    return true
  }

  _get_order(c) {
    if (!c?.order) return []
    return c.order.trim().split(/[,; ]+/)
  }

  _get_hide(c) {
    if (!c?.hide) return []
    return c.hide.trim().split(/[,; ]+/)
  }

  _log(plugin, result, obj) {
    const name = this.resolve_plugin_name(plugin)

    // collate results
    result.human = obj.human
    if (!result.human) {
      const r = this.private_collate(result, name)
      result.human = r.join(', ')
      result.human_html = r.join(', \t ')
    }

    // logging results
    if (obj.emit) this.conn.loginfo(plugin, result.human) // by request
    if (obj.err) {
      const errMsg = types.isNativeError(obj.err) ? obj.err.message : obj.err
      this.conn.logerror(plugin, errMsg)
    }
    if (!obj.emit && !obj.err) {
      // by config
      const pic = cfg[name]
      if (pic?.debug) this.conn.logdebug(plugin, result.human)
    }
    return result.human
  }
}

function default_result() {
  return { pass: [], fail: [], msg: [], err: [], skip: [] }
}

module.exports = ResultStore
