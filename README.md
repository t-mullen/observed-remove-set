# observed-remove-set

An "Observed-Remove Set" or "OR-Set", is a set that can be modified concurrently and will eventually reach the same state everywhere (it is "eventually consistent").

A casuality-tracking method is also included, allowing operations to be delivered in any order and more-than-once.

Also see [observed-remove-map](https://github.com/RationalCoding/observed-remove-map), which is built on top of this module.

## example

```javascript
var set1 = new OrSet('bob')
var set2 = new OrSet('alice')

// let's provide a "delay" function to simulate concurrency on a network
function delay (cb) {
  setTimeout(cb, 3000) // 3 seconds of delay!
}

// let's "connect" our two sets
set1.on('op', op => delay(() => set2.receive(op)))
set2.on('op', op => delay(() => set1.receive(op)))

// both sets start with a single a
set1.add('a') 
set2.add('a')

// now below, we introduce a conflict
set1.add('a')
set2.delete('a')
```

Look at the last two lines. There is a conflict there! Did `set1` delete the `'a'` and re-add it? Or did it add a redundant `'a'` only to delete it soon after? With normal sets, we cannot know and we may end up with `set1 = []` and `set2 = ['a']`.

However, these are **OR-Sets** and have eventual consistency. Therefore we can be *certain* that `set1 = set2`. We can't predict the end state, but we are guaranteed that all connected sets will reach the same state at the end of our operations.

## install

```
npm install observed-remove-set
```

```html
<script src="dist/or-set.js"></script>
```

## api

### `orSet = new OrSet(uuid, [opts])`

Create a new OR-Set.

Required `uuid` is some universally unique identifer for this set.

Optional `opts` defaults to the following object:
```javascript
{
  state: null, // an initial state from getState()
  serialize: JSON.serialize, // function used to internally serialize elements
  parse: JSON.parse // function used to internally parse elements
}
```

### `orSet.add(element)`

Add an element to the set.

`element` is any Javascript object. Changes to this object will NOT be replicated.

### `orSet.delete(element)`

Remove an element from the set.

### `orSet.has(element)`

Returns `true` if `element` is contained within the set, `false` otherwise.

### `orSet.values()`

Returns an array with all elements within the set.

### `orSet.size()`

Returns an integer that is the size of set.

### `orSet.receive(op)`

Receive an operation from a remote set. Must be called exactly once per remote operation.

### `orSet.on('op', function (op) {})`

Fires when an operation needs to be sent to connected sets. Operations can be delivered in any order but should be delivered at least once.

`op` is the operation object that needs to be passed into `otherOrSet.receive(op)` for all other replicas.

### `orSet.on('add', function (element) {})`

Fires when an element is added to the set by a *remote* operation. (will **not** fire when `orSet.add()` is called locally.)

### `orSet.on('delete', function (element) {})`

Fires when an element is removed from the set by a *remote* operation. (will **not** fire when `orSet.delete()` is called locally.)

### `orSet.getState()`

Get the underlying state of the CRDT. Can be used to transfer state to peers that are just joining and have missed operations. Keep in mind that operations can be sent while transfering state and a 2-step sync is required.

### `orSet.setState(state)`

Set the underlying state of the CRDT. Equivalent to passing state into the constructor.
