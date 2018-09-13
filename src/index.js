var EventEmitter = require('nanobus')
var inherits = require('inherits')

inherits(OrSet, EventEmitter)

function OrSet (site, opts) {
  var self = this
  if (!(self instanceof OrSet)) return new OrSet(site, opts)

  EventEmitter.call(this)

  opts = opts || {}

  self._serialize = opts.serialize || JSON.stringify
  self._parse = opts.parse || JSON.parse

  self._references = {} // observed
  self._tombstones = {} // remove
  self._causality = {}

  self._site = site
  self._counter = 0

  if (opts.state) self.setState(opts.state)
}

OrSet.prototype.setState = function (state) {
  var self = this

  var parsed = self._parse(state)
  self._references = parsed.references
  self._tombstones = parsed.tombstones
  self._causality = parsed.causality
}

OrSet.prototype.getState = function () {
  var self = this

  return self._serialize({
    references: self._references,
    tombstones: self._tombstones,
    causality: self._causality
  })
}

OrSet.prototype._unique = function () {
  var self = this

  self._counter++
  return [self._counter, self._site]
}

OrSet.prototype.receive = function (op) {
  var self = this

  var site = op.uuid[1]
  var causality = self._causality[site] = self._causality[site] || { counter: 1, queue: [] }

  if (op.uuid[0] > causality.counter) {
    causality.queue.push(op)
  } else if (op.uuid[0] === causality.counter) {
    if (op.type === 'add') {
      self._remoteAdd(op.element, op.uuid)
    } else {
      self._remoteDelete(op.element, op.deletedReferences)
    }

    causality.counter++ // increment causuality counter

    // check if any other operations are now "causually ready"
    for (var i = 0; i < causality.queue.length; i++) {
      var qop = causality.queue[i]
      if (qop.uuid[0] === causality.counter) {
        causality.queue.splice(i, 1)
        self.receive(qop)
        return
      }
    }
  }
}

// O(1)
OrSet.prototype.add = function (element) {
  var self = this

  element = self._serialize(element)

  var uuid = self._unique()
  self._references[element] = self._references[element] || []
  self._references[element].push(uuid)

  self.emit('op', new AddOperation({ element, uuid }))

  self._garbageCollection(element)
}

// O(1)
OrSet.prototype._remoteAdd = function (element, uuid) {
  var self = this

  self._references[element] = self._references[element] || []
  self._references[element].push(uuid)

  self.emit('add', self._parse(element))

  self._garbageCollection(element)
}

// integrate and clear any tombstones
OrSet.prototype._garbageCollection = function (element) {
  var self = this

  if (!self._tombstones[element]) return
  var tombstones = self._tombstones[element]
  self._tombstones[element] = []
  self._remoteDelete(element, tombstones)
}

// O(1)
OrSet.prototype.delete = function (element) {
  var self = this

  element = self._serialize(element)

  if (!self._references[element]) return // can't delete something we don't have

  var deletedReferences = self._references[element]
  delete self._references[element]

  var uuid = self._unique()

  self.emit('op', new DeleteOperation({ uuid, element, deletedReferences }))
}

OrSet.prototype._addTombstones = function (element, tombstones) {
  var self = this

  if (tombstones.length > 0) {
    if (self._tombstones[element]) {
      self._tombstones[element] = self._tombstones[element].concat(tombstones)
    } else {
      self._tombstones[element] = tombstones
    }
  }
}

// O(nm): n = number of adds, m = removed adds (both remain low)
OrSet.prototype._remoteDelete = function (element, deletedReferences) {
  var self = this

  // find all the deletes for which we cannot integrate yet, mark with a tombstone
  if (!self._references[element]) {
    self._addTombstones(element, deletedReferences)
    return
  }

  var tombstones = OrSet._intersection(deletedReferences, self._references[element])
  self._addTombstones(element, tombstones)

  // remove all pairs that the remote replica has seen
  self._references[element] = OrSet._intersection(self._references[element], deletedReferences)
  if (self._references[element].length > 0) return // element is still there

  delete self._references[element]
  self.emit('delete', self._parse(element))
}

// O(1)
OrSet.prototype.has = function (element) {
  var self = this

  element = self._serialize(element)

  return !!self._references[element]
}

// O(1)
OrSet.prototype.size = function () {
  var self = this

  return Object.keys(self._references).length
}

// O(n) : n = number of elements in set
OrSet.prototype.values = function () {
  var self = this

  return Object.keys(self._references).map((element) => self._parse(element))
}

// O(n) : n = number of elements in set
OrSet.prototype.toString = function () {
  var self = this

  return self._serialize(self.values())
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

function AddOperation ({ uuid, element }) {
  this.type = 'add'
  this.uuid = uuid
  this.element = element
}

function DeleteOperation ({ uuid, element, deletedReferences }) {
  this.type = 'delete'
  this.uuid = uuid // uuid here isn't needed for CRDT, used for causality
  this.element = element
  this.deletedReferences = deletedReferences
}

module.exports = OrSet
