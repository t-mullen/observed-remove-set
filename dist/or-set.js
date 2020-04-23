(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OrSet = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],2:[function(require,module,exports){
assert.notEqual = notEqual
assert.notOk = notOk
assert.equal = equal
assert.ok = assert

module.exports = assert

function equal (a, b, m) {
  assert(a == b, m) // eslint-disable-line eqeqeq
}

function notEqual (a, b, m) {
  assert(a != b, m) // eslint-disable-line eqeqeq
}

function notOk (t, m) {
  assert(!t, m)
}

function assert (t, m) {
  if (!t) throw new Error(m || 'AssertionError')
}

},{}],3:[function(require,module,exports){
var splice = require('remove-array-items')
var nanotiming = require('nanotiming')
var assert = require('assert')

module.exports = Nanobus

function Nanobus (name) {
  if (!(this instanceof Nanobus)) return new Nanobus(name)

  this._name = name || 'nanobus'
  this._starListeners = []
  this._listeners = {}
}

Nanobus.prototype.emit = function (eventName) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.emit: eventName should be type string or symbol')

  var data = []
  for (var i = 1, len = arguments.length; i < len; i++) {
    data.push(arguments[i])
  }

  var emitTiming = nanotiming(this._name + "('" + eventName.toString() + "')")
  var listeners = this._listeners[eventName]
  if (listeners && listeners.length > 0) {
    this._emit(this._listeners[eventName], data)
  }

  if (this._starListeners.length > 0) {
    this._emit(this._starListeners, eventName, data, emitTiming.uuid)
  }
  emitTiming()

  return this
}

Nanobus.prototype.on = Nanobus.prototype.addListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.on: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.on: listener should be type function')

  if (eventName === '*') {
    this._starListeners.push(listener)
  } else {
    if (!this._listeners[eventName]) this._listeners[eventName] = []
    this._listeners[eventName].push(listener)
  }
  return this
}

Nanobus.prototype.prependListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.prependListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.prependListener: listener should be type function')

  if (eventName === '*') {
    this._starListeners.unshift(listener)
  } else {
    if (!this._listeners[eventName]) this._listeners[eventName] = []
    this._listeners[eventName].unshift(listener)
  }
  return this
}

Nanobus.prototype.once = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.once: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.once: listener should be type function')

  var self = this
  this.on(eventName, once)
  function once () {
    listener.apply(self, arguments)
    self.removeListener(eventName, once)
  }
  return this
}

Nanobus.prototype.prependOnceListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.prependOnceListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.prependOnceListener: listener should be type function')

  var self = this
  this.prependListener(eventName, once)
  function once () {
    listener.apply(self, arguments)
    self.removeListener(eventName, once)
  }
  return this
}

Nanobus.prototype.removeListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.removeListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.removeListener: listener should be type function')

  if (eventName === '*') {
    this._starListeners = this._starListeners.slice()
    return remove(this._starListeners, listener)
  } else {
    if (typeof this._listeners[eventName] !== 'undefined') {
      this._listeners[eventName] = this._listeners[eventName].slice()
    }

    return remove(this._listeners[eventName], listener)
  }

  function remove (arr, listener) {
    if (!arr) return
    var index = arr.indexOf(listener)
    if (index !== -1) {
      splice(arr, index, 1)
      return true
    }
  }
}

Nanobus.prototype.removeAllListeners = function (eventName) {
  if (eventName) {
    if (eventName === '*') {
      this._starListeners = []
    } else {
      this._listeners[eventName] = []
    }
  } else {
    this._starListeners = []
    this._listeners = {}
  }
  return this
}

Nanobus.prototype.listeners = function (eventName) {
  var listeners = eventName !== '*'
    ? this._listeners[eventName]
    : this._starListeners

  var ret = []
  if (listeners) {
    var ilength = listeners.length
    for (var i = 0; i < ilength; i++) ret.push(listeners[i])
  }
  return ret
}

Nanobus.prototype._emit = function (arr, eventName, data, uuid) {
  if (typeof arr === 'undefined') return
  if (arr.length === 0) return
  if (data === undefined) {
    data = eventName
    eventName = null
  }

  if (eventName) {
    if (uuid !== undefined) {
      data = [eventName].concat(data, uuid)
    } else {
      data = [eventName].concat(data)
    }
  }

  var length = arr.length
  for (var i = 0; i < length; i++) {
    var listener = arr[i]
    listener.apply(listener, data)
  }
}

},{"assert":2,"nanotiming":5,"remove-array-items":6}],4:[function(require,module,exports){
var assert = require('assert')

var hasWindow = typeof window !== 'undefined'

function createScheduler () {
  var scheduler
  if (hasWindow) {
    if (!window._nanoScheduler) window._nanoScheduler = new NanoScheduler(true)
    scheduler = window._nanoScheduler
  } else {
    scheduler = new NanoScheduler()
  }
  return scheduler
}

function NanoScheduler (hasWindow) {
  this.hasWindow = hasWindow
  this.hasIdle = this.hasWindow && window.requestIdleCallback
  this.method = this.hasIdle ? window.requestIdleCallback.bind(window) : this.setTimeout
  this.scheduled = false
  this.queue = []
}

NanoScheduler.prototype.push = function (cb) {
  assert.equal(typeof cb, 'function', 'nanoscheduler.push: cb should be type function')

  this.queue.push(cb)
  this.schedule()
}

NanoScheduler.prototype.schedule = function () {
  if (this.scheduled) return

  this.scheduled = true
  var self = this
  this.method(function (idleDeadline) {
    var cb
    while (self.queue.length && idleDeadline.timeRemaining() > 0) {
      cb = self.queue.shift()
      cb(idleDeadline)
    }
    self.scheduled = false
    if (self.queue.length) self.schedule()
  })
}

NanoScheduler.prototype.setTimeout = function (cb) {
  setTimeout(cb, 0, {
    timeRemaining: function () {
      return 1
    }
  })
}

module.exports = createScheduler

},{"assert":2}],5:[function(require,module,exports){
var scheduler = require('nanoscheduler')()
var assert = require('assert')

var perf
nanotiming.disabled = true
try {
  perf = window.performance
  nanotiming.disabled = window.localStorage.DISABLE_NANOTIMING === 'true' || !perf.mark
} catch (e) { }

module.exports = nanotiming

function nanotiming (name) {
  assert.equal(typeof name, 'string', 'nanotiming: name should be type string')

  if (nanotiming.disabled) return noop

  var uuid = (perf.now() * 10000).toFixed() % Number.MAX_SAFE_INTEGER
  var startName = 'start-' + uuid + '-' + name
  perf.mark(startName)

  function end (cb) {
    var endName = 'end-' + uuid + '-' + name
    perf.mark(endName)

    scheduler.push(function () {
      var err = null
      try {
        var measureName = name + ' [' + uuid + ']'
        perf.measure(measureName, startName, endName)
        perf.clearMarks(startName)
        perf.clearMarks(endName)
      } catch (e) { err = e }
      if (cb) cb(err, name)
    })
  }

  end.uuid = uuid
  return end
}

function noop (cb) {
  if (cb) {
    scheduler.push(function () {
      cb(new Error('nanotiming: performance API unavailable'))
    })
  }
}

},{"assert":2,"nanoscheduler":4}],6:[function(require,module,exports){
'use strict'

/**
 * Remove a range of items from an array
 *
 * @function removeItems
 * @param {Array<*>} arr The target array
 * @param {number} startIdx The index to begin removing from (inclusive)
 * @param {number} removeCount How many items to remove
 */
module.exports = function removeItems (arr, startIdx, removeCount) {
  var i, length = arr.length

  if (startIdx >= length || removeCount === 0) {
    return
  }

  removeCount = (startIdx + removeCount > length ? length - startIdx : removeCount)

  var len = length - removeCount

  for (i = startIdx; i < len; ++i) {
    arr[i] = arr[i + removeCount]
  }

  arr.length = len
}

},{}],7:[function(require,module,exports){
var EventEmitter = require('nanobus')
var inherits = require('inherits')

inherits(OrSet, EventEmitter)

function OrSet(site, opts) {
  if (!(this instanceof OrSet)) return new OrSet(site, opts)

  EventEmitter.call(this)

  opts = opts || {}

  this._serialize = opts.serialize || JSON.stringify
  this._parse = opts.parse || JSON.parse

  this._references = new Map() // observed
  this._tombstones = new Map() // remove
  this._causality = new Map()

  this._site = site
  this._counter = 0

  if (opts.state) this.setState(opts.state)
}

OrSet.prototype.setState = function (state) {
  var parsed = this._parse(state)
  this._references = new Map(parsed.references)
  this._tombstones = new Map(parsed.tombstones)
  this._causality = new Map(parsed.causality)
}

OrSet.prototype.getState = function () {
  return this._serialize({
    references: Array.from(this._references.entries()),
    tombstones: Array.from(this._tombstones.entries()),
    causality: Array.from(this._causality.entries())
  })
}

OrSet.prototype._unique = function () {
  this._counter++
  return [this._counter, this._site]
}

OrSet.prototype.receive = function (op) {
  const site = op.uuid[1]
  this._causality.set(site, this._causality.get(site) || { counter: 1, queue: [] })
  const causality = this._causality.get(site)

  if (op.uuid[0] > causality.counter) {
    causality.queue.push(op)
  } else if (op.uuid[0] === causality.counter) {
    if (op.type === 'add') {
      this._remoteAdd(op.element, op.uuid)
    } else {
      this._remoteDelete(op.element, op.deletedReferences)
    }

    causality.counter++ // increment causuality counter

    // check if any other operations are now "causually ready"
    for (let i = 0; i < causality.queue.length; i++) {
      const qop = causality.queue[i]
      if (qop.uuid[0] === causality.counter) {
        causality.queue.splice(i, 1)
        this.receive(qop)
        return
      }
    }
  }
}

// O(1)
OrSet.prototype.add = function (element) {
  element = this._serialize(element)

  const uuid = this._unique()
  this._references.set(element, this._references.get(element) || [])
  this._references.get(element).push(uuid)

  this.emit('op', new AddOperation({ element, uuid }))

  this._garbageCollection(element)
}

// O(1)
OrSet.prototype._remoteAdd = function (element, uuid) {
  this._references.set(element, this._references.get(element) || [])
  this._references.get(element).push(uuid)

  if (this._references.get(element).length === 1) this.emit('add', this._parse(element))

  this._garbageCollection(element)
}

// integrate and clear any tombstones
OrSet.prototype._garbageCollection = function (element) {
  if (!this._tombstones.has(element)) return
  const tombstones = this._tombstones.get(element)
  this._tombstones.set(element, [])
  this._remoteDelete(element, tombstones)
}

// O(1)
OrSet.prototype.delete = function (element) {
  element = this._serialize(element)

  if (!this._references.has(element)) return // can't delete something we don't have

  const deletedReferences = this._references.get(element)
  this._references.delete(element)

  const uuid = this._unique()

  this.emit('op', new DeleteOperation({ uuid, element, deletedReferences }))
}

OrSet.prototype._addTombstones = function (element, tombstones) {
  if (tombstones.length > 0) {
    if (this._tombstones.has(element)) {
      this._tombstones.set(element, this._tombstones.get(element).concat(tombstones))
    } else {
      this._tombstones.set(element, tombstones)
    }
  }
}

// O(nm): n = number of adds, m = removed adds (both remain low)
OrSet.prototype._remoteDelete = function (element, deletedReferences) {
  // find all the deletes for which we cannot integrate yet, mark with a tombstone
  if (!this._references.has(element)) {
    this._addTombstones(element, deletedReferences)
    return
  }

  const tombstones = OrSet._difference(deletedReferences, this._references.get(element))
  this._addTombstones(element, tombstones)

  // remove all pairs that the remote replica has seen
  this._references.set(element, OrSet._difference(this._references.get(element), deletedReferences))
  if (this._references.get(element).length > 0) return // element is still there

  this._references.delete(element)
  this.emit('delete', this._parse(element))
}

// O(1)
OrSet.prototype.has = function (element) {
  element = this._serialize(element)
  return this._references.has(element)
}

// O(1)
OrSet.prototype.size = function () {
  return this._references.size
}

// O(n) : n = number of elements in set
OrSet.prototype.values = function () {
  return Array.from(this._references.keys()).map((element) => this._parse(element))
}

// O(n) : n = number of elements in set
OrSet.prototype.toString = function () {
  return this._serialize(this.values())
}

// A - B
// O(mn)
OrSet._difference = function (a, b) {
  return a.filter((ae) => {
    return !b.some((be) => {
      return ae[0] === be[0] && ae[1] === be[1]
    })
  })
}

function AddOperation({ uuid, element }) {
  this.type = 'add'
  this.uuid = uuid
  this.element = element
}

function DeleteOperation({ uuid, element, deletedReferences }) {
  this.type = 'delete'
  this.uuid = uuid // uuid here isn't needed for CRDT, used for causality
  this.element = element
  this.deletedReferences = deletedReferences
}

module.exports = OrSet

},{"inherits":1,"nanobus":3}]},{},[7])(7)
});
