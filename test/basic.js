var test = require('tape')
var OrSet = require('./../')

test('test intersection', function (t) {
  var set1 = [[1,2], [3,2], [1, 1], [5, 1]]
  var set2 = [[1,2], [2,3], [1, 1]]
  
  var intersection = OrSet._intersection(set1, set2)
  
  t.deepEquals(intersection, [[3, 2], [5, 1]])
  t.end()
})

test('test toString', function (t) {
  var set1 = OrSet('1')
  
  set1.add('a')
  set1.add('b')
  set1.add('c')

  var expected = ['a', 'b', 'c']
  
  t.equal(set1.toString(), JSON.stringify(expected), 'string matches expected')
  t.end()

})

test('test has', function (t) {
  var set1 = OrSet('1')

  set1.add('a')

  t.assert(set1.has('a'), 'has returns true')
  t.end()
})

test('test add', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  set1.on('op', op => set2.receive(op))
  set2.on('op', op => set1.receive(op))
  
  set1.add('a')
  set2.add('b')
  set1.add('b')
  
  t.assert(set1.values().indexOf('a') !== -1, 'a in set1')
  t.assert(set2.values().indexOf('a') !== -1, 'a in set2')
  
  t.assert(set1.values().indexOf('b') !== -1, 'b in set1')
  t.assert(set2.values().indexOf('b') !== -1, 'b in set2')
  
  t.equals(set1.size(), 2)
  t.equals(set2.size(), 2)
  t.end()
})

test('test add/delete', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  set1.on('op', op => set2.receive(op))
  set2.on('op', op => set1.receive(op))
  
  set1.add('a')
  set2.add('b')
  set1.add('b')
  set1.delete('b')
  
  t.assert(set1.values().indexOf('a') !== -1, 'a in set1')
  t.assert(set2.values().indexOf('a') !== -1, 'a in set2')
  
  t.assert(set1.values().indexOf('b') === -1, 'b NOT in set1')
  t.assert(set2.values().indexOf('b') === -1, 'b NOT in set2')
  
  t.equals(set1.size(), 1)
  t.equals(set2.size(), 1)
  t.end()
})

test('test concurrent delete/delete', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  var op1 = []
  var op2 = []
  
  set1.on('op', op => {
    op1.push(op)
  })
  set2.on('op', op => {
    op2.push(op)
  })
  
  set1.add('a')
  set2.receive(op1.shift())
  
  set1.delete('a')
  set2.delete('a')
  set1.receive(op2.shift())
  set2.receive(op1.shift())
  
  t.assert(set1.values().indexOf('a') === -1, 'a NOT in set1')
  t.assert(set2.values().indexOf('a') === -1, 'a NOT in set2')
  
  t.equals(set1.size(), 0)
  t.equals(set2.size(), 0)
  t.end()
})

test('test concurrent add/delete', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  var op1 = []
  var op2 = []
  
  set1.on('op', op => {
    op1.push(op)
  })
  set2.on('op', op => {
    op2.push(op)
  })
  
  set1.add('a')
  set2.receive(op1.shift())
  
  set1.add('a') // re-adding a
  set2.delete('a')
  set1.receive(op2.shift())
  set2.receive(op1.shift())

  // Add wins
  t.assert(set1.values().indexOf('a') !== -1, 'a in set1')
  t.assert(set2.values().indexOf('a') !== -1, 'a in set2')
  
  t.equals(set1.size(), 1)
  t.equals(set2.size(), 1)
  t.end()
})

test('test concurrent early delete (add not received)', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  var set3 = OrSet('3')
  
  var op1 = []
  var op2 = []
  var op3 = []
  
  set1.on('op', op => op1.push(op))
  set2.on('op', op => op2.push(op))
  // set3.on('op', op => op3.push(op))
  
  set1.add('a')             // 1 adds
  set2.receive(op1[0])      // 2 receives add
  set2.delete('a')          // 2 deletes
  set1.delete('a')          // 1 also deletes
  set3.receive(op2[0])      // 3 receives delete before add
  set3.receive(op1[1])      // 3 receives ANOTHER delete before add
  set3.receive(op1[0])      // 3 finally receives add (and integrates past delete via tombstone)
  set1.receive(op2[0])      // 1 receives delete

  t.assert(set1.values().indexOf('a') === -1, 'a NOT in set1')
  t.assert(set2.values().indexOf('a') === -1, 'a NOT in set2')
  t.assert(set3.values().indexOf('a') === -1, 'a NOT in set3')
  
  t.equals(set1.size(), 0)
  t.equals(set2.size(), 0)
  t.equals(set3.size(), 0)
  t.end()
})

test('test out-of-order delivery', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  var op1 = []
  var op2 = []
  
  set1.on('op', op => {
    op1.push(op)
  })
  set2.on('op', op => {
    op2.push(op)
  })
  
  set1.add('a')
  set1.add('b')
  set1.delete('b')
  
  set2.add('a')
  set2.delete('a')
  set2.add('d')

  set1.receive(op2.pop())
  set1.receive(op2.pop())
  set1.receive(op2.pop())
  set2.receive(op1.pop())
  set2.receive(op1.pop())
  set2.receive(op1.pop())

  t.assert(set1.values().indexOf('a') !== -1, 'a in set1')
  t.assert(set2.values().indexOf('a') !== -1, 'a in set2')
  
  t.equals(set1.size(), 2)
  t.equals(set2.size(), 2)
  t.end()
})


test('test more-than-once delivery', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  var op1 = []
  var op2 = []
  
  set1.on('op', op => {
    op1.push(op)
  })
  set2.on('op', op => {
    op2.push(op)
  })
  
  set1.add('a')
  set1.add('b')
  set1.delete('b')
  
  set2.add('a')
  set2.delete('a')
  set2.add('d')

  set1.receive(op2[0])
  set1.receive(op2.shift())
  set1.receive(op2[0])
  set1.receive(op2[0])
  set1.receive(op2.shift())
  set1.receive(op2[0])
  set1.receive(op2.shift())

  set2.receive(op1[0])
  set2.receive(op1.shift())
  set2.receive(op1[0])
  set2.receive(op1[0])
  set2.receive(op1.shift())
  set2.receive(op1.shift())

  t.assert(set1.values().indexOf('a') !== -1, 'a in set1')
  t.assert(set2.values().indexOf('a') !== -1, 'a in set2')
  
  t.equals(set1.size(), 2)
  t.equals(set2.size(), 2)
  t.end()
})

test('test state transfer', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  
  set1.on('op', op => set2.receive(op))
  set2.on('op', op => set1.receive(op))

  set1.add('a')
  set1.add('b')
  set1.delete('b')
  
  set2.add('a')
  set2.delete('a')
  set2.add('d')

  var set3 = OrSet('3', { state: set1.getState() })
  t.deepEquals(set1.values(), set3.values())

  set3.on('op', op => set2.receive(op))
  set3.on('op', op => set1.receive(op))
  set2.on('op', op => set3.receive(op))
  set3.add('x')
  set2.add('g')
  t.deepEquals(set2.values(), set3.values())
  t.deepEquals(set2.values(), set1.values())

  t.end()
})

test('test random operations and delays', function (t) {
  var set1 = OrSet('1')
  var set2 = OrSet('2')
  var set3 = OrSet('3')
  
  var op1 = []
  var op2 = []
  var op3 = []
  
  var waiting = 0
  
  function afterRandomDelay(cb) {
    setTimeout(cb, Math.random() * 3000) // 0-5 seconds
  }
  
  // pushes to queue, then after a random time, takes the top off the queue
  // like all CRDTs, relatively causality between sites needs to be preserved
  set1.on('op', op => {
    for (var i=0; i<3; i++) { // more-than-once
      op1.push(op)
      waiting++

      afterRandomDelay(() => {
        var opn = op1.pop() // out of order
        set2.receive(opn)
        set3.receive(opn)
        waiting--
        checkIfDone()
      })
    }
  })
  set2.on('op', op => {
    for (var i=0; i<3; i++) { // more-than-once
      op2.push(op)
      waiting++

      afterRandomDelay(() => {
        var opn = op2.pop() // out of order
        set1.receive(opn)
        set3.receive(opn)
        waiting--
        checkIfDone()
      })
    }
  })
  set3.on('op', op => {
    for (var i=0; i<3; i++) { // more-than-once
      op3.push(op)
      waiting++
      
      afterRandomDelay(() => {
        var opn = op3.pop() // out of order
        set2.receive(opn)
        set1.receive(opn)
        waiting--
        checkIfDone()
      })
    }
  })
  
  var obj = {}
  obj.set1 = set1
  obj.set2 = set2
  obj.set3 = set3
  for (var i=0; i<300; i++) {
    var site = 1 + Math.floor(Math.random() * 3)
    var op = ['add', 'delete'][Math.floor(Math.random() * 2)]
    var value = Math.random()
    
    obj['set'+site][op](value)
  }
  
  function checkIfDone () {
    if (waiting > 0) return
    
    var size = set1.size()
    t.equals(set2.size(), size)
    t.equals(set3.size(), size)
    
    set1.values().forEach((value) => {
      t.assert(set2.values().indexOf(value) !== -1)
      t.assert(set3.values().indexOf(value) !== -1)
    })
    
    set2.values().forEach((value) => {
      t.assert(set1.values().indexOf(value) !== -1)
      t.assert(set3.values().indexOf(value) !== -1)
    })
    
    set3.values().forEach((value) => {
      t.assert(set2.values().indexOf(value) !== -1)
      t.assert(set1.values().indexOf(value) !== -1)
    })
    
    t.end()
  }
})
