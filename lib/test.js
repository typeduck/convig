/* eslint-env mocha */
'use strict'

const should = require('should')
const convig = require('../')

describe('convig', function () {
  let a =
    { one: 'one' }
  let b = {
    one: 'two',
    two: 'three'
  }
  let c = {
    one: 'three',
    two: 'four',
    three: 'five',
    four () { return `four and ${this.one}` },
    five () { return process.pid }
  }

  it('should prefer first objects', function () {
    let CONFIG = convig.chain(a, b, c)
    CONFIG.one.should.equal('one')
    CONFIG.two.should.equal('three')
    CONFIG.three.should.equal('five')
    CONFIG.four.should.equal('four and one')
    CONFIG.five.should.equal(process.pid)
  })

  it('should load process.env, too', function () {
    process.env.one = 'ONE'
    let CONFIG = convig.env(a, b, c)
    CONFIG.one.should.equal('ONE')
    CONFIG.two.should.equal('three')
    CONFIG.three.should.equal('five')
    CONFIG.four.should.equal('four and ONE')
    CONFIG.five.should.equal(process.pid)
  })

  it('should cast integers', function () {
    let first = { a: '19' }
    let second = { a: 20 }
    let CONFIG = convig.chain(first, second)
    CONFIG.a.should.equal(19)
  })

  it('should cast floats', function () {
    let first = { a: '19.5' }
    let second = { a: 42.000000001 }
    let CONFIG = convig.chain(first, second)
    CONFIG.a.should.be.approximately(19.5, 0.000001)
  })

  it('should cast booleans', function () {
    let first = { a: 'true', b: 'on', c: '1', d: 'yes' }
    let second = { a: false, b: false, c: false, d: false }
    let CONFIG = convig.chain(first, second)
    CONFIG.a.should.equal(true)
    CONFIG.b.should.equal(true)
    CONFIG.c.should.equal(true)
    CONFIG.d.should.equal(true)
  })

  // RegExp casting
  it('should cast RegExp properly', function () {
    let first = { rxGreen: 'tree|bush', rxBlue: '/sky|eyes|jeans/i', rxRed: '/fire/' }
    let second = { rxGreen: /green/, rxBlue: /blue/, rxRed: /red/ }
    let CONFIG = convig.chain(first, second)
    CONFIG.rxGreen.test('green').should.be.false()
    CONFIG.rxGreen.test('tree').should.be.true()
    CONFIG.rxGreen.test('bush').should.be.true()
    CONFIG.rxBlue.test('blue').should.be.false()
    CONFIG.rxBlue.test('sKy').should.be.true()
    CONFIG.rxBlue.test('EYEs').should.be.true()
    CONFIG.rxBlue.test('Jeans').should.be.true()
    CONFIG.rxRed.test('red').should.be.false()
    CONFIG.rxRed.test('Fire').should.be.false()
    CONFIG.rxRed.test('fire').should.be.true()
  })

  it('should be able to handle +Infinity/-Infinity defaults, values', function () {
    let def = { a: Infinity, b: -Infinity, c: Infinity, d: 10, e: 10 }
    let first = { c: '+15', d: '+Infinity', e: '-Infinity' }
    let CONFIG = convig.chain(first, def).warn().warn()
    CONFIG.a.should.equal(Infinity)
    CONFIG.b.should.equal(-Infinity)
    CONFIG.c.should.equal(15)
    CONFIG.d.should.equal(Infinity)
    CONFIG.e.should.equal(-Infinity)
  })

  it('should be able to throw exceptions', function () {
    let first = {}
    let last = { a () { throw new Error('I am a thrower') } }
    let CONFIG = convig.chain(first, last)
    should.throws(function () {
      CONFIG.a
    })
  })

  // When chains cascade, we should not be skipping defaults that are missing
  // from middle chains last resorts!
  it('should be able to skip over middle chains', function () {
    let input = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }
    let second = { answer: 42 }
    let other = { answer: 99 }
    let middle = convig.chain(input, second, { a: 2, c: 2, e: 2, g: 2 })
    let last = convig.chain(middle, other, { a: 3, b: 3, c: 3, answer: 80 })

    middle.a.should.equal(1)
    should.not.exist(middle.b)
    middle.c.should.equal(1)
    should.not.exist(middle.d)
    middle.e.should.equal(1)
    should.not.exist(middle.f)
    middle.g.should.equal(2)
    should.not.exist(middle.answer)

    last.a.should.equal(1)
    last.b.should.equal(1)
    last.c.should.equal(1)
    should.not.exist(last.d)
    should.not.exist(last.e)
    should.not.exist(last.f)
    should.not.exist(last.g)
    last.answer.should.equal(42)
  })

  // allow last-resort spec to use an array
  it('should be able to split CSV into string array', function () {
    let input = { a: 'a,b,c' }
    let conf = convig.chain(input, { a: ['d', 'e', 'f'] })
    conf.a.should.eql(['a', 'b', 'c'])
    input = { a: ['x', 'y', 'z'] }
    conf = convig.chain(input, { a: ['d', 'e', 'f'] })
    conf.a.should.eql(['x', 'y', 'z'])
    // using a different splitter
    input = { a: 'a;b;c' }
    conf = convig.chain(input, { a: ['d', 'e', 'f'] })
    conf.a.should.eql(['a;b;c'])
    conf.split = ';'
    conf.a.should.eql(['a', 'b', 'c'])
    conf.split = ','
    conf.a.should.eql(['a;b;c'])
  })

  // make sure the 'internal' property is not exposed, no functions exposed, but
  // normal getters are enumerable
  it('should not expose the _chain in a loop', function () {
    let input = {
      a () { return `${this.b}` },
      b: 'Bee!'
    }
    let conf = convig.chain(input, { a: 'a', b: 'b' })
    let check = {}
    for (let prop in conf) {
      let val = conf[prop]
      if (typeof val === 'function') {
        throw new Error(`${prop} gave a function`)
      } else if (prop === '_chain') {
        throw new Error('internal _chain exposed')
      } else {
        check[prop] = val
      }
    }
    check.a.should.equal('Bee!')
    check.b.should.equal('Bee!')
  })

  // chains of itself
  it('should properly handle long chains', function () {
    let conf0 = convig.chain({ a: 'A0' })
    let conf1 = convig.chain(conf0, {
      a: 'A1',
      b: 'B1'
    })
    conf1.a.should.equal('A0')
    conf1.b.should.equal('B1')
    let conf2 = convig.chain(conf1, {
      a: 'A2',
      b: 'B2',
      c: 'C2'
    })
    conf2.a.should.equal('A0')
    conf2.b.should.equal('B1')
    conf2.c.should.equal('C2')
    let conf3 = convig.chain(conf2, {
      a: 'A3',
      b: 'B3',
      c: 'C3',
      d: 'D3'
    })
    conf3.a.should.equal('A0')
    conf3.b.should.equal('B1')
    conf3.c.should.equal('C2')
    conf3.d.should.equal('D3')
  })

  // multiple function chains
  it('should properly handle functions in chains', function () {
    let input = { a: 'A0' }
    let conf1 = convig.chain(input, {
      a () { throw new Error('A1') },
      b () { return 'B1' }
    })
    conf1.a.should.equal('A0')
    conf1.b.should.equal('B1')
    let conf2 = convig.chain(conf1, {
      a () { throw new Error('A2') },
      b () { throw new Error('B2') },
      c () { return 'C2' }
    })
    conf2.a.should.equal('A0')
    conf2.b.should.equal('B1')
    conf2.c.should.equal('C2')
  })

  // last resort as chain
  return it('should properly handle chain as last resort', function () {
    let conf0 = convig.chain({ a () { return 'A0' } })
    let conf1 = convig.chain(conf0, {
      a () { throw new Error('a not defined') },
      b () { throw new Error('b not defined') }
    })
    let conf2 = convig.chain({ b: 'B0' }, conf0, conf1)
    conf2.a.should.equal('A0')
    conf2.b.should.equal('B0')
    conf0.a.should.equal('A0')
    conf1.a.should.equal('A0')
  })
})
