'use strict'

const debug = require('debug')('convig')
if (process.env.NODE_ENV === 'production') { debug.enabled = true }

class ConfigChain {
  constructor (fromChain, LASTRESORT) {
    if (LASTRESORT instanceof ConfigChain) {
      LASTRESORT = LASTRESORT._lastResort
    }
    // Build up chain, unwinding other ConfigChains into single chain
    let chain = []
    Object.defineProperty(this, '_chain', { get () { return chain.slice() } })
    Object.defineProperty(this, '_lastResort', { get () { return LASTRESORT } })
    let elem
    while ((elem = fromChain.pop())) {
      chain.unshift(elem)
      if (elem instanceof ConfigChain) {
        chain = elem._chain.concat(chain)
      }
    }

    // allow the array splitter to be changed
    let splitter = ','
    Object.defineProperty(this, 'split', {
      set (val) { if (typeof val === 'string') { splitter = val } },
      get () { return splitter }
    })
    // Triggers the warnings for all default values
    Object.defineProperty(this, 'warn', {
      get () {
        return () => {
          for (let k in LASTRESORT) { this[k] }
          return this
        }
      }
    })

    // Evaluates the value found in the chain. Usually just the value itself, with
    // some casting based on the final value
    let evil = (val, finalType) => {
      let type = typeof val
      if (type === 'function') {
        val = val.call(this)
      }
      // Integer is pimped out to deal with the infinite
      if (finalType === 'int') {
        if (val === 'Infinity' || val === '+Infinity') {
          val = Infinity
        } else if (val === '-Infinity') {
          val = -Infinity
        }
        if (Math.abs(val) !== Infinity) { val = parseInt(val, 10) }
      }
      if (finalType === 'float') {
        val = parseFloat(val)
      }
      // process.env casts true/false to STRINGS, e.g. "true"/"false"
      if (finalType === 'boolean') {
        let ref = `${val}`.toLowerCase()
        val = ['true', 'on', '1', 'yes'].indexOf(ref) !== -1
      }
      // split comma strings
      if (finalType === 'array' && type === 'string') {
        val = val.split(splitter)
      }
      // RegExp Handling
      if (finalType === 'regexp') {
        val = createRegexp(val)
      }
      return val
    }

    // Warning text
    let warnObj = chain[0] === process.env ? 'process.env' : '[convig-chain]'
    // Ensures warnings are only output once
    let alreadyWarned = []
    let warnFormat = `[%s] WARNING: ${warnObj}['%s'] not set, using '%s'`

    let len = chain.length
    let propFinder = function (prop, finalType) {
      let ix = -1
      while (++ix < len) {
        let toCheck = chain[ix]
        if (toCheck[prop] != null) {
          return evil(toCheck[prop], finalType)
        }
      }
      // If we fall off the chain, use last resort & output warning
      let val = evil(LASTRESORT[prop], finalType)
      // SKIP warning if default is null
      if (val != null && alreadyWarned.indexOf(prop) === -1) {
        debug(warnFormat, (new Date()).toISOString(), prop, val)
        alreadyWarned.push(prop)
      }
      return val
    }

    for (let prop in LASTRESORT) {
      let val = LASTRESORT[prop]
      let type = typeof val
      if (Array.isArray(val)) {
        type = 'array'
      } else if (val instanceof RegExp) {
        type = 'regexp'
      } else if (typeof val === 'number') {
        type = Math.round(val) === val ? 'int' : 'float'
      }

      Object.defineProperty(this, prop, {
        enumerable: true,
        get: propFinder.bind(null, prop, type)
      })
    }
  }
}

// RegExp-finding RegExp: string starts with slash, ends with slash/flags
function createRegexp (s) {
  let mExp = /^\/(.*)\/([gimy]*)$/.exec(s)
  if (mExp) {
    return new RegExp(mExp[1], mExp[2])
  } else {
    return new RegExp(s)
  }
}

// Reads configuration from objects with cascading preference. The *LAST*
// argument is considered the "last resort" and a warning on console.error is
// issued whenever it is read from.
function chain (...args) {
  let LASTRESORT = args.pop() // "last resort" which triggers warning
  return new ConfigChain(args, LASTRESORT) // return Object with getters
}

// Just a wrapper for the chain above
function env (...args) {
  args.unshift(process.env)
  return chain.apply(this, args)
}

exports.chain = chain
exports.env = env
