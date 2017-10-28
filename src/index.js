var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

inherits(OrSet, EventEmitter)

function OrSet (site, opts) {
  var self = this
  if (!(self instanceof OrSet)) return new OrSet(site, opts)

  opts = opts || {}

  self._serialize = opts.serialize || JSON.stringify
  self._parse = opts.parse || JSON.parse

  self._uuids = {}
  self._elements = new Set()
  self._tombstones = {}
  self._deleteQueue = []

  self._site = site
  self._counter = 0
}

OrSet.prototype._unique = function () {
  var self = this

  self._counter++
  return [self._counter, self._site]
}

OrSet.prototype.receive = function (op) {
  var self = this

  if (op[0] === 'add') {
    self._remoteAdd(op[1], op[2])
  } else {
    self._remoteDelete(op[1], op[2])
  }
}

// O(1)
OrSet.prototype.add = function (e) {
  var self = this

  e = self._serialize(e)

  var uuid = self._unique()
  self._uuids[e] = self._uuids[e] || []
  self._uuids[e].push(uuid)

  self._elements.add(e)

  self.emit('op', ['add', e, uuid])

  self._garbageCollection(e)
}

// O(1)
OrSet.prototype._remoteAdd = function (e, uuid) {
  var self = this

  self._uuids[e] = self._uuids[e] || []
  self._uuids[e].push(uuid)

  self._elements.add(e)

  self.emit('add', self._parse(e))

  self._garbageCollection(e)
}

// integrate and clear any tombstones
OrSet.prototype._garbageCollection = function (e) {
  var self = this

  if (!self._tombstones[e]) return
  var tombstones = self._tombstones[e]
  self._tombstones = []
  self._remoteDelete(e, tombstones)
}

// O(1)
OrSet.prototype.delete = function (e) {
  var self = this

  e = self._serialize(e)

  if (!self._elements.has(e)) return // can't delete something we don't have

  var deletedUuids = self._uuids[e]
  delete self._uuids[e]

  self._elements.delete(e)

  self.emit('op', ['delete', e, deletedUuids])
}

OrSet.prototype._addTombstones = function (e, tombstones) {
  var self = this

  if (tombstones.length > 0) {
    if (self._tombstones[e]) {
      self._tombstones[e] = self._tombstones[e].concat(tombstones)
    } else {
      self._tombstones[e] = tombstones
    }
  }
}

// O(nm): n = number of adds, m = removed adds (both remain low)
OrSet.prototype._remoteDelete = function (e, deletedUuids) {
  var self = this

  // find all the deletes for which we cannot integrate yet, mark with a tombstone
  if (!self._uuids[e]) {
    self._addTombstones(e, deletedUuids)
    return
  } else {
    var tombstones = OrSet._intersection(deletedUuids, self._uuids[e])
    self._addTombstones(e, tombstones)
  }

  // remove all pairs that the remote replica has seen
  self._uuids[e] = OrSet._intersection(self._uuids[e], deletedUuids)
  if (self._uuids[e].length > 0) return // element is still there

  delete self._uuids[e]
  self._elements.delete(e)
  self.emit('delete', self._parse(e))
}

// O(1)
OrSet.prototype.has = function (e) {
  var self = this

  e = self._serialize(e)

  return self._elements.has(e)
}

// O(1)
OrSet.prototype.size = function () {
  var self = this

  return self._elements.size
}

// O(n) : n = number of elements in set
OrSet.prototype.values = function () {
  var self = this

  return Array.from(self._elements).map((e) => self._parse(e))
}

// O(n) : n = number of elements in set
OrSet.prototype.toString = function (encoding) {
  var self = this

  return self.values().toString()
}

// A - B
// O(mn)
OrSet._intersection = function (a, b) {
  return a.filter((ae) => {
    return !b.some((be) => {
      return ae[0] === be[0] && ae[1] === be[1]
    })
  })
}

module.exports = OrSet
