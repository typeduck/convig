# A ConfigChain has a series of chain which it will check in order and a
# "lastResort" specification which will trigger warnings.
class ConfigChain
  constructor: (fromChain, LASTRESORT) ->
    # Build up chain, unwinding other ConfigChains into single chain
    chain = []
    Object.defineProperty(@, "_chain", { get: () -> chain.slice() })
    while (elem = fromChain.pop())
      if elem instanceof ConfigChain
        chain = elem._chain.concat(chain)
      else
        chain.unshift(elem)
    
    # allow the array splitter to be changed
    splitter = ","
    Object.defineProperty(@, "split", {
      set: (val) -> splitter = val if typeof val is "string"
    })
    # Triggers the warnings for all default values
    Object.defineProperty(@, "warn", {
      get: () ->
        return () =>
          x = @[k] for k of LASTRESORT
          return @
    })

    # Evaluates the value found in the chain. Usually just the value itself, with
    # some casting based on the final value
    evil = (val, finalType) =>
      type = typeof val
      if type is "function"
        val = val.call(@)
      # Integer is pimped out to deal with the infinite
      if finalType is "int"
        if val is "Infinity" or val is "+Infinity"
          val = Infinity
        else if val is "-Infinity"
          val = -Infinity
        val = parseInt(val, 10) if Math.abs(val) isnt Infinity
      if finalType is "float"
        val = parseFloat(val)
      # process.env casts true/false to STRINGS, e.g. "true"/"false"
      if finalType is "boolean"
        val = ("#{val}".toLowerCase() in ["true", "on", "1", "yes"])
      # split comma strings
      if finalType is "array" and type is "string"
        val = val.split(splitter)
      return val
    
    # Warning text
    warnObj = if chain[0] is process.env then "process.env" else "[convig-chain]"
    # Ensures warnings are only output once
    alreadyWarned = []
    warnFormat = "[%s] WARNING: #{warnObj}['%s'] not set, using '%s'"
   
    len = chain.length           # to no recalculate length
    # goes along the chain looking for 
    propFinder = (prop, finalType) ->
      ix = -1
      while ++ix < len
        return evil(toCheck[prop], finalType) if (toCheck = chain[ix])[prop]?
      # If we fall off the chain, use last resort & output warning
      val = evil(LASTRESORT[prop], finalType)
      # SKIP warning if default is null
      return val if val is null
      if prop not in alreadyWarned
        console.error(warnFormat, new Date(), prop, val)
        alreadyWarned.push(prop)
      return val
    
    for prop, val of LASTRESORT
      if Array.isArray(val)
        type = "array"
      else if "number" is type = typeof val
        type = if Math.round(val) is val then "int" else "float"

      Object.defineProperty(@, prop, {
        enumerable: true
        get: propFinder.bind(null, prop, type)
      })


# Reads configuration from objects with cascading preference. The *LAST*
# argument is considered the "last resort" and a warning on console.error is
# issued whenever it is read from.
@chain = (args...) ->

  LASTRESORT = args.pop()     # "last resort" which triggers warning
  return new ConfigChain(args, LASTRESORT)  # return Object with getters

# Just a wrapper for the chain above
@env = (args...) ->
  args.unshift(process.env)
  @chain.apply(@, args)

# A Method that will return application ID based on args/pm2 process title
rxPM2 = /^pm2[^:]*\:\s*(.+?)(\.(js|coffee))?$/i
rxScript = /([^/]+?)(\.(js|coffee))?$/
@appId = (fallback = null) ->
  fallback ?= process.argv[1]
  if process.title is "node" and m = rxScript.exec(process.argv[1])
    return m[1]
  else if m = rxPM2.exec(process.title)
    return m[1]
  else
    return fallback
