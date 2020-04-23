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
  const localCausality = [[this._site, { counter: this._counter + 1, queue: [] }]]
  return this._serialize({
    references: Array.from(this._references.entries()),
    tombstones: Array.from(this._tombstones.entries()),
    causality: Array.from(this._causality.entries()).concat(localCausality)
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
