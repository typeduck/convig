# Configuration via process.env, with warnings

Get configuration from `process.env` (or other objects), loading defaults from a
*last resort* declaration.

Retrieving the default value from the *last resort* object will trigger a
warning when retrieved for the first time **and** one of the following is true:

- `NODE_ENV=production` - in production, supply full configuration
- `DEBUG=convig` - standard [debug](https://github.com/visionmedia/debug)

## Usage

```javascript
convig = require("convig");
CONFIG = convig.chain(process.env, {foo: "FOO", bool: "on", dne: 0}, {
  foo: "foo"
  ,bar: function(){ return this.foo + ", and bar, too"; }
  ,baz: function(){ throw new Error("baz may NOT fallback!"); }
  ,numInt: 42
  ,numFloat: Math.PI
  ,infinite: Infinity
  ,bool: false
  ,noWarning: null
  ,csv: ["a", "b", "c"]
});
```

The above says to get values from *process.env*, then an object literal, and as
a *last resort* from the default object at the end -- which also declares the
types. When the *last resort* value is used, a warning will be written on stderr
(but only the first time, and only if the *last resort* value isn't *null*).

**NOTE:** you can trigger warnings by calling the special function "warn", which
  returns the configuration object:

```javascript
CONFIG = config.chain(process.env, {
  foo: "foo"
}).warn()
```


In the (contrived) example above, the *CONFIG* return value provides getters
which behave as follows:
- process.env will be tried first, then the second object literal, then the
  *last resort*.
- the *CONFIG* **only** has getters from "last resort"
  - e.g. the *dne* property of the object literal is not reachable via *CONFIG*.
- values retrieved in the chain *before* "last resort" are cast to the same type
  as those in the last resort. This allows ENV vars (always strings) to be cast
  as either numbers, or (more helpfully) booleans or even arrays.
  - "on", "true", "yes" & "1" are cast to true, anything else is false
  - if *last resort* value is an array, and retrieved value is a string, it will
    be split by commas (or another separator - keep reading) into array of
    strings
  - if *last resort* is an integer, strings "Infinity" and "-Infinity" cast as
    expected (e.g. you get the javascript Infinity)
  - if *last resort* is +/-Infinity, strings and literal Infinity-values work,
    everything else will be cast to an integer
  - if *last resort* is RegExp, values will be cast into RegExp objects. flags
    are parsed when strings start & end with "/" (plus optional flags).
- instead of literals, functions may be provided, in which case they will be
  called with *this* scoped to the CONFIG object.

Assuming **no matches** on process.env set above:

```javascript
CONFIG.foo;       // "FOO"
CONFIG.bar;       // "FOO, and bar, too"
CONFIG.baz;       // throws Error! do this to require e.g. process.env to be set
CONFIG.bool;      // true (from "on" in object literal)
CONFIG.numInt;    // 42
CONFIG.numFloat;  // Math.PI
CONFIG.infinite;  // Infinity
CONFIG.dne;       // undefined
CONFIG.noWarning; // null (will not output a warning)
CONFIG.csv        // ["a", "b", "c"]
```

Another way to declare process.env as first preference is:

```javascript
require("convig").env(nonWarningDefaults, lastResort)
```

More likely, you are only interested in the *last resort* definition:
require("convig").env(lastResort)

## Split string into array

You can change the character used to split strings into an array (when the last
resort entry is an array) using the setter property *split*.

```javascript
CONFIG = convig.chain({mylist: "click;clack;zoom"}, {
  mylist: ["these", "are a", "few of my", "favourite", "strings"]
})
CONFIG.mylist      // ["click;clack;zoom"] - array, but not quite right
CONFIG.split = ";" // use a semicolon when splitting arrays from here on out
CONFIG.mylist      // ["click", "clack", "zoom"]
CONFIG.split = "," // you can even set it back if you want to
CONFIG.mylist      // ["click;clack;zoom"] - still an array, but no comma!
```
