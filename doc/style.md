This is a set of guidelines for writing clear, organized, high-quality code in Privacy Badger and other Jetpack-based Firefox addons, based on the [Meteor Style Guide](https://github.com/meteor/meteor/wiki/Meteor-Style-Guide).

All code in pull requests should follow these rules.

## Commit messages

The first line of a commit should be 50 characters or less.  This is a soft limit, so that git's command line output is more readable.  Use this line as a clear summary of the change.  Try using imperative language in this line.  A good commit message is "Add reactive variable for CPU clock speed".  Worse examples include "cpu clock speed" or "Added Clock.CPU_speed so that we can avoid a setTimeout in the main example."

Subsequent lines (if any) can be fairly verbose and detailed.  Use your judgement.

## Whitespace

* 2 space indents (setq js-indent-level 2)
* spaces, not literal tabs (setq-default indent-tabs-mode nil)
* no trailing whitespace (setq-default show-trailing-whitespace t)
* maximum line length 80 (setq-default fill-column 80)

Emacs users should check out [js2-mode](https://github.com/mooz/js2-mode) for a nice way to avoid silly javascript errors, and help enforce standards.

## Spaces between tokens

Separate tokens with a single space as in these examples:

`a = b + 1`, not `a=b+1`

`function (a, b, c) { return 1; }`, not `function(a,b,c) {return 1;}`

`for (i = 0; i < 3; i++)`, not `for(i=0;i<3;i++)`

`a(1, 2, 3)`, not `a(1,2,3)`

`{ a: 1, b: 2 }`, not `{a:1,b:2}`

`if (a)`, not `if(a)`

Unary negation also takes a space:

`if (! a)`, not `if (!a)`

But increment and decrement operators don't take a space:

`a++`, not `a ++`

`--b`, not `-- b`

When functions or objects fit entirely on a single line, put a space inside the enclosing braces:

`stack.push({ parent: node, red: true })`, not `stack.push({parent:node, red: true})`

`a(function () { return true; })`, not `a(function () {return true;})`

Single-line arrays don't get that space though:

`samples.concat([1, 2, 3])`, not `samples.concat([ 1, 2, 3 ])`

## Comments

Code should be well commented. Make sure to document the most important pieces of information for both users of the code and future maintainers of the code.

Most functions should begin with a comment explaining what they do, what arguments they take, and what they return. A good function comment allows developers to use a function without having to read it's source.

Most files should start with a comment explaining what functionality is in the file. A good file comment allows developers to understand how the different pieces in the system fit together without having to read a lot of code.

Also comment liberally inside functions. For example, objects saved as class members should note what the object keys and values are. Any tricky bits of code should have a comment explaining what is going on. Focus on documenting _why_ the code is the way it is, not _what_ it does.

Generally prefer `//` comments to `/*`. Use `/*` comments when putting a comment in the middle of a statement. Javadoc `/**` style comments are OK for function definitions.

Bad:

```javascript
let Whirlygig = function (name) {
  let self = this;
  self.name = name;
  self.values = {};
};

_.extend(Whirlygig.prototype, {
  /* add a value */
  addValue: function (x) {
    self.values[x.key] = x.value - 1; // subtract 1 from value
  },

  /* get serialized list */
  serialize: function () {
    return _.map(self.values, function (v, k) {
      let newVal = mungeValue(v, false);
      return {key: k, value: v + 1}; // add 1 to values
    });
  }
});
```


Good:

```javascript
// A Whirlygig represents a remote client's view of the global Weasel.
// It can receive arbitrary values from the network and save them
// for later use.
let Whirlygig = function (name) {
  let self = this;
  self.name = name; // name of the remote weasel
  self.values = {};  // remote key name -> 0-indexed value

};

_.extend(Whirlygig.prototype, {
  // Take a key/value pair from the remote Weasel and save it locally.
  addValue: function (x) {
    // Weasels use 1-indexed arrays. Subtract 1 to convert to 0-indexed.
    self.values[x.key] = x.value - 1;
  },

  // Return a list of stored values in a format suitable for sending to
  // a Weasel.
  serialize: function () {
    return _.map(self.values, function (v, k) {
      let newVal = mungeValue(v, false /* foldValue */);
      // Weasels use 1-indexed arrays. Add 1 to convert back to 1-indexed.
      newVal = newVal + 1;
      return {key: k, value: newVal};
    });
  }
});
```

## Use camelCase for identifiers

Functions should be named like `doAThing`, not `do_a_thing`.

Other variable names get the same treatment: `isConnected`, not `is_connected`.

## Private identifiers start with underscores

If a method or property name starts with `_`, it's a private implementation detail and shouldn't be used from outside the module where it is defined. It could disappear or change at any time.

## Brace style

Use this brace style:

    if (a < 0) {
      console.log("a is negative");
      handleNegativeA();
    } else if (a > 0) {
      console.log("a is positive");
      handlePositiveA();
    } else {
      console.log("a is zero or NaN");
      handleOtherA();
    }

### Braces are optional around single-statement blocks

You may leave out the curly braces when the block's condition and its body are each short enough to fit on one line:

    if (! alreadyDone)
      doSomething();

    while (node.parentNode)
      node = node.parentNode;

    // BUT NOT:
    if (somethingVeryVeryVeryVeryLong &&
        somethingElseLong)
      shortBody();
    // AND NOT:
    if (something)
      someLongFunctionCall(
          withThisArg,
          andThatArg);

If you feel that the code would be much easier to read with braces, though, you can add them at your discretion.

It's OK to have braces in one branch of an if..else construct, and not another:

    if (widgetMarketOpen) {
      buyWidgets();
      sellWidgets();
    } else
      throw new Error("No widget trading for you!");

## Always use semicolons; beware semicolon insertion when breaking lines

JavaScript permits semicolons to be omitted sometimes at the end of statements. Don't do this.

When breaking lines you must be careful to avoid the JavaScript semicolon insertion feature. For example, this code:

    return
      doSomething() * 2 + 27;

will be interpreted in JavaScript as:

    return;
    doSomething() * 2 + 27;

## Signature comment for `arguments`

If a function takes more arguments than there are formal parameters (via `arguments`), comment like so:

    _.extend(Foo.prototype, {
      myVariadicFunction: function (/* arguments */) { ... },
      anotherVariadicFunction: function (x, y, z, /* arguments */) { ... },
    });

(Not `/* varargs */` -- that's a C concept.)

## `self` rather than `this`

For methods that are more than a line or two long, always begin with `let self = this`, and always use `self`, never `this`. Ideally, do this everywhere. (Rationale: if the method contains callbacks or other local functions, it is far too easy to write `this` inside the function, expecting to get the outer `this`. You need to use `self` in those cases. At that point, it's too hard to remember when to use `self` and when to use `this`, so you need to use `self` everywhere.)

## Class pattern

Prefer singleton objects to closures if there is any chance your closure might ever possibly get refactored into an object (which is often the case).

Use the native Javascript system: `new` and prototypes. Begin your constructor function with (1) `let self = this`, and then (2) define every single attribute that will ever be defined on the object, in straight-line code, commenting each one. If any of them are public, indicate this in the comments. Then, define methods on the class by extending its prototype. Private methods should start with `_`. For public (API) classes, avoid private methods if possible/convenient, but don't go to extreme lengths.

## Avoid setting variables to `undefined` -- instead, use `null`

Reserve `undefined` to mean "argument not provided" or "no such key in object". Use `null` in other cases, especially the case where a variable's type is "Foo or nothing", eg, "`Array<String>` or `null`", "`String` or `null`" (analogous to `NULL` in C, `null` in SQL, `foo option` in ML...)

## Never close over loop variables

This code is broken:

    for (let a in foo) {
      stuff.push(function () { console.log(a); }); // Broken
    }
    _.each(stuff, function (f) { f(); });

If foo is `{ x:1, y:2, z:3 }`, it will print 'z' three times, because all three functions created inside the loop point at the same instance of the variable `a`, which will have the value it has at the end of the loop. This fix won't help:

    for (let a in foo) {
      let x = a;
      stuff.push(function () { console.log(x); }); // Still broken
    }
    _.each(stuff, function (f) { f(); });

because Javascript has only one scope per function (it is as if it floats the definition of 'x' up to the beginning of the nearest enclosing function.) You will need to do something more aggressive:

    // Use bind
    let func = function (x) { console.log(x); };
    for (let a in foo) {
      stuff.push(_.bind(func, null, a)); // Works
    }
    _.each(stuff, function (f) {f();});

    // Or a higher-order function
    let makeFunc = function (x) { return function () { console.log(x); }; };
    for (let a in foo) {
      stuff.push(makeFunc(a)); // Works
    }
    _.each(stuff, function (f) {f();});

    // Or put the relevant part of the loop body in a separate function
    let addFunc = function (x) {stuff.push(function () {console.log(x);})};
    for (let a in foo) {
      addFunc(a); // Works
    }
    _.each(stuff, function (f) { f(); });

    // Or don't use a native loop
    _.each(_.keys(a), function (x) {
      stuff.push(function () { console.log(x); }); // Works
    });
    _.each(stuff, function (f) { f(); });

    // Or refactor to avoid
    for (let a in foo) {
      console.log(a);
    }

Often, none of these alternatives will look very good. Use your discretion and creativity.

## Equality Testing

Always use `===`, not `==`.

If you want to compare a number to a string version of said number, use `x === parseInt(y)`, `x.toString() === y`, or `x === +y`. It is much more clear what is going on. (Note that those alternatives differ in how they handle non-numeric characters or leading zeros in the string. Only the third alternative gets all the edge cases right.)

## Coercion to boolean

If you have a value that could be truthy or falsey, and you want to convert it to `true` or `false`, the preferred idiom is `!!`:

    let getStatus = function () {
      // Return status (a non-empty string) if available, else null
    };

    let isStatusAvailable = function () {
      return !! getStatus();
    };

## `||` for default values

`||` is handy for introducing default values:

    this.name = this.name || "Anonymous";

    _.each(this.items || [], function () { ... });

But be careful. This doesn't work if `false` is a valid value.

## `&&` for conditional function calls

`&&` can be handy when conditionally calling a function for its value:

    // Preferred
    return event && handleEvent(event);

    // Not preferred
    return event ? handleEvent(event) : null;

We also like to use it to call a function only if some other value is present:

    // Preferred
    for (let node = first; node; node = node.parent) {
      node.label && node.callback && node.callback(node.label);
    }

    // Not preferred (unless it's clearer in a particular case)
    for (let node = first; node; node = node.parent) {
      if (node.label && node.callback)
        node.callback(node.label);
    }

It's true that this confuses people who haven't seen `&&` used in this way before. But once you're used to it it's easy to read and convenient. We think it's worth the tradeoff.

## `a && b || c`

This is an idiom borrowed from Python. It does the same thing as `a ? b : c`, except that if `a` and `b` are both false, it returns `c`. You should use `a && b || c` only where `a ? b : c` won't do the job.

    // If we have a name, return the entry for it in Template, if any. Otherwise return {}.
    return name && Template[name] || {};

    // This is subtly different. It will return undefined if name is truthy but isn't present in Template.
    return name ? Template[name] : {};

Take a moment to convince yourself that `a && b || c` works as advertised, then memorize its behavior and don't give it another thought.

## Keyword arguments with `options`

If a function takes a lot of arguments, especially if many of those arguments are optional, or several of the arguments are functions, don't try to put all of the arguments in the function's signature. Instead, add a final argument, `options`.

    let makeCube = function (owner, options) {
      // Provide default values for the options
      options = _.extend({
        color: 'grey',
        weight: 1.0,
        material: 'aluminum',
        onRender: function () {},
        onDestroy: function () {}
      }, options);

      console.log(owner + ", here is your " + options.color + "cube.");
      options.onRender();
      ...
    });

Keep the most important arguments in the signature (eg, `owner` above.) Ideally, the arguments in the signature are the "cake" (the main substance and structure of the operation), and the options are the "icing" (frills and modifiers.)

However, this is just a guideline. You should do whatever will make life easiest for the person calling the function. Consider the situation from their point of view. What are they trying to accomplish by calling your function? What will make the callsite look clearest to someone reading the code a year later who doesn't understand it?

## Functions should be consistent about whether they return a value

Either: all `return`s in a function should either explicitly return a value (perhaps `undefined`), and function should end with an explicit `return` or `throw`; or there should be no `return`s in the function which return a value.  (`js2-mode.el` will complain if you don't, and often its complaints indicate an actual bug where you meant to `return false` or something.)

```js
let BAD1 = function () {
  if (x)
    return 5;
};
let BAD2 = function () {
  if (x)
    return;
  return 5;
};
let GOOD1 = function () {
  if (x)
    return 5;
  throw Error("Nope");
};
let GOOD2 = function () {
  if (x)
    return 5;
  return undefined;
};
```

## Exporting/importing code modules

The Firefox Add-on SDK uses CommonJS constructs (`require` and `exports`) to share code between modules.

If you're loading a built-in SDK module, use the following form (no dot prefix):

    const tabs = require("sdk/tabs");

If you're loading a local module, always use dot prefixes in the module path:

    const { sha256sum } = require("./dependencies/crypto");
    const utils = require("../utils");

## XPCOM

Always use Cc/Ci/Cr/Cm/Cu instead of Components.classes/Components.interfaces/Components.results/Components.manager/Components.utils. With the Add-on SDK, you can import these with a line like the following:

    const { Cc, Ci } = require("chrome");

## Variable declarations

Prefer `let` to `var` for variable declarations in general. Use `const` for imported variables and modules.
