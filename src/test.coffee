###############################################################################
# Tests the cascading configuration
###############################################################################

require("should")
convig = require("./index")

describe "convig", () ->
  a =
    one: "one"
  b =
    one: "two"
    two: "three"
  c =
    one: "three"
    two: "four"
    three: "five"
    four: () -> "four and #{@one}"
    five: () -> process.pid
  
  it "should prefer first objects", () ->
    CONFIG = convig.chain(a, b, c)
    CONFIG.one.should.equal "one"
    CONFIG.two.should.equal "three"
    CONFIG.three.should.equal "five"
    CONFIG.four.should.equal "four and one"
    CONFIG.five.should.equal process.pid

  it "should load process.env, too", () ->
    process.env.one = "ONE"
    CONFIG = convig.env(a, b, c)
    CONFIG.one.should.equal "ONE"
    CONFIG.two.should.equal "three"
    CONFIG.three.should.equal "five"
    CONFIG.four.should.equal "four and ONE"
    CONFIG.five.should.equal process.pid

  it "should cast integers", () ->
    first = {a: "19"}
    second = {a: 20}
    CONFIG = convig.chain(first, second)
    CONFIG.a.should.equal 19

  it "should cast floats", () ->
    first = {a: "19.5"}
    second = {a: 42.000000001}
    CONFIG = convig.chain(first, second)
    CONFIG.a.should.be.approximately( 19.5, 0.000001 )

  it "should cast booleans", () ->
    first = {a: "true", b: "on", c: "1", d: "yes"}
    second = {a: false, b: false, c: false, d: false}
    CONFIG = convig.chain(first, second)
    CONFIG.a.should.equal true
    CONFIG.b.should.equal true
    CONFIG.c.should.equal true
    CONFIG.d.should.equal true

  it "should be able to throw exceptions", (done) ->
    first = {}
    last = {a: () -> throw new Error("I am a thrower")}
    CONFIG = convig.chain(first, last)
    try
      val = CONFIG.a
      done(new Error("No Error thrown!"))
    catch e
      done(null)

  # When chains cascade, we should not be skipping defaults that are missing
  # from middle chains last resorts!
  it "should be able to skip over middle chains", () ->
    input = {a: 1, b: 1, c: 1, d: 1, e: 1, f: 1}
    second = {answer: 42}
    other = {answer: 99}
    middle = convig.chain(input, second, {a: 2, c: 2, e: 2, g: 2})
    last = convig.chain(middle, other, {a: 3, b: 3, c: 3, answer: 80})
    
    middle.a.should.equal(1)
    (middle.b is undefined).should.equal(true)
    middle.c.should.equal(1)
    (middle.d is undefined).should.equal(true)
    middle.e.should.equal(1)
    (middle.f is undefined).should.equal(true)
    middle.g.should.equal(2)
    (middle.answer is undefined).should.equal(true)
    
    last.a.should.equal(1)
    last.b.should.equal(1)
    last.c.should.equal(1)
    (last.d is undefined).should.equal(true)
    (last.e is undefined).should.equal(true)
    (last.f is undefined).should.equal(true)
    (last.g is undefined).should.equal(true)
    last.answer.should.equal(42)

  # allow last-resort spec to use an array
  it "should be able to split CSV into string array", () ->
    input = {a: "a,b,c"}
    conf = convig.chain(input, {a: ["d", "e", "f"]})
    conf.a.should.eql( ["a", "b", "c"] )
    input = {a: ["x", "y", "z"]}
    conf = convig.chain(input, {a: ["d", "e", "f"]})
    conf.a.should.eql( ["x", "y", "z"] )
    # using a different splitter
    input = {a: "a;b;c"}
    conf = convig.chain(input, {a: ["d", "e", "f"]})
    conf.a.should.eql( ["a;b;c"] )
    conf.split = ";"
    conf.a.should.eql( ["a", "b", "c"] )
    conf.split = ","
    conf.a.should.eql( ["a;b;c"] )
    # the splitter is a set-only property!
    (conf.split is undefined).should.equal(true)

  # make sure the 'internal' property is not exposed, no functions exposed, but
  # normal getters are enumerable
  it "should not expose the _chain in a loop", () ->
    input = {a: (() -> "#{@b}"), b: "Bee!"}
    conf = convig.chain(input, {a: "a", b: "b"})
    check = {}
    for prop, val of conf
      if typeof val is "function"
        throw new Error("#{prop} gave a function")
      else if prop is "_chain"
        throw new Error("internal _chain exposed")
      else
        check[prop] = val
    check.a.should.equal("Bee!")
    check.b.should.equal("Bee!")

  # only testing for mocha, we can't really test for other things...
  it "should give me an appId", () ->
    convig.appId().should.equal("_mocha")
