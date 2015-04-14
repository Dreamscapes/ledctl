/**
 * Dreamscapes\ledctl
 *
 * Licensed under the BSD-3-Clause license
 * For full copyright and license information, please see the LICENSE file
 *
 * @author     Robert Rossmann <rr.rossmann@me.com>
 * @copyright  2014 Robert Rossmann
 * @link       https://github.com/Dreamscapes/ledctl
 * @license    http://choosealicense.com/licenses/bsd-3-clause  BSD-3-Clause License
 */

'use strict'

/** @private */
var fs = require('fs')
  , path = require('path')
  , util = require('util')
  , async = require('async')
  , morse = require('./serialisers/morse')
  , fmt = util.format   // shortcut...
  // Every time we run .discover(), the results for given ROOT are cached here
  // This improved test runs from 42ms to 34ms with 19 tests - I'd say that's worth it, given the
  // expected massive load this library will have to withstand...
  , discoveredLEDs = {}

module.exports = LEDController


/**
 * @summary   All the fun begins by creating an instance of this class
 *
 * @class
 * @param     {String}    identifier  The LED identifier - one of the values returned by
 *                                    {@link LEDController.discover}. If there is only one LED
 *                                    available, the identifier is optional.
 */
function LEDController (identifier) {

  var availableLEDs = LEDController.discover()
  // If no identifier specified but there is only a single LED available, control that one
  if (! identifier && availableLEDs.length === 1)
    identifier = availableLEDs[0]

  // scope
  var that = this
  // Full fs path to the LED's directory
    , location = path.join(LEDController.ROOT, identifier || '')
  // Helper function... I will use this a LOT
    , define = Object.defineProperty.bind(null, this)
  // Brightness and triggers will be attached to current instance down the constructor
    , brightness
    , triggers

  // Required (and required-to-be-valid) argument
  // Also takes care of identifier being undefined
  if (! ~ availableLEDs.indexOf(identifier))
    throw new Error(fmt('No such LED: \'%s\' in %s', identifier, LEDController.ROOT))

  // brightness information (will be attached to `this`)
  brightness =
    { min: 0
    , max: Number.parseInt(contentOf(location, 'max_brightness'))
    }
  // brightness.cur
  Object.defineProperty(brightness, 'cur',
    { enumerable: true
    , get: function getBrightness () {
        return Number.parseInt(contentOf(that.location, 'brightness'))
      }
    }
  )

  // triggers information (will be attached to `this`)
  triggers =
    { all: getTriggerData(location).all
    }
  // triggers.cur
  Object.defineProperty(triggers, 'cur',
    { enumerable: true
    , get: function getTrigger () {
        return getTriggerData(that.location).cur
      }
    }
  )


  /**
   * @summary   The LED's identifier, as given to the constructor
   *
   * @desc      Just a helper for you, dear developer...
   *
   * @readonly
   * @member    {String}    LEDController#id
   */
  define('id', { enumerable: true, value: identifier })

  /**
   * @summary   The current LED's full filesystem location
   *
   * @readonly
   * @member    {String}    LEDController#location
   */
  define('location', { enumerable: true, value: location })

  /**
   * @summary   The LED's brightness information
   *
   * @readonly
   * @member    {Object}    LEDController#brightness
   * @property  {integer}   min         Minimum brightness level allowed
   * @property  {integer}   max         Maximum brightness level allowed
   * @property  {integer}   cur         Current brightness level (sync getter)
   */
  define('brightness', { enumerable: true, value: Object.freeze(brightness) })

  /**
   * @summary   The LED's supported triggers and currently enabled trigger
   *
   * @readonly
   * @member    {Object}    LEDController#triggers
   * @property  {Array}     all         List of supported triggers (strings)
   * @property  {String}    cur         Currently selected trigger (sync getter)
   */
  define('triggers', { enumerable: true, value: Object.freeze(triggers) })

  /**
   * @summary   A worker queue that makes sure we write the events to the filesystem in the intended
   *            order
   *
   * @private
   * @member    {Object}    LEDController#writer
   * @see       {@link https://github.com/caolan/async#queueworker-concurrency Async / Queue}
   */
  define('writer', { value: async.queue(writeWorker.bind(this), 1) })

  /**
   * @summary   A worker queue that handles blinking operations and keeps the events ordered in the
   *            asynchronous chaos of Node
   *
   * @private
   * @member    {Object}    LEDController#blinker
   * @see       {@link https://github.com/caolan/async#queueworker-concurrency Async / Queue}
   */
  define('blinker', { value: async.queue(blinkWorker.bind(this), 1) })
}


/**
 * @summary   Root path where LEDController should look for LEDs
 *
 * @desc      Feel free to override if your OS puts LED definitions somewhere else.
 *
 * @type      {String}
 * @default   /sys/class/leds/
 */
LEDController.ROOT = '/sys/class/leds/'

/**
 * @summary   Base rate at which the LED will blink
 *
 * @desc      The rate controls how fast the LED will blink. If the base blink event duration is one
 *            second, and the rate is 2, then the actual duration of the blink event will be
 *            calculated as duration divided by rate, i.e. 1s / 2 => 0.5s. The rate gives you an
 *            opportunity to speed up or slow down blink rate without modifying any of your code.
 *
 * @type      {Number}
 * @default   1
 */
LEDController.RATE = 1


/**
 * @summary   Discover available LEDs on current system
 *
 * @desc      This sync function may be quite slow depending on the number of files and folders
 *            within {@link LEDController.ROOT}.
 *
 * @return    {Array}                 List of LED IDs willing to bend to your will
 */
LEDController.discover = function discover () {

  var root = LEDController.ROOT   // Shortcut
    , candidates = fs.existsSync(root) ? fs.readdirSync(root) : []
    , leds = []
    , candidatePath
    , dir

  // Results already in cache?
  if (discoveredLEDs[root])
    return discoveredLEDs[root]   // No need to access fs again!

  // Do a best effort guess if the folders within root really look like LEDs and ignore the rest
  for (var candidate of candidates) {
    candidatePath = path.join(root, candidate)

    // Consider only directories in current folder
    if (! fs.statSync(candidatePath).isDirectory())
      continue

    dir = fs.readdirSync(candidatePath)

    // Directories which contain files 'trigger' and 'brightness' look like a LED - use them!
    if (~ dir.indexOf('trigger') && ~ dir.indexOf('brightness'))
      leds.push(candidate)
  }

  // Cache the results for later use to speed things up
  discoveredLEDs[root] = Object.freeze(leds)    // Into the ice with ya!

  return leds
}

/**
 * @summary   A custom blink parser for you to implement
 *
 * @typedef   {Function}    LEDController.Parser
 * @param     {mixed}       input     Whatever you would like to convert into blink events
 * @return    {Array}       An array of {@link LEDController.Blink Blink} objects which represent
 *                          the sequence in which the LED should blink
 *
 * @see       {@link LEDController#morse Example parser implementation}
 * @see       serialisers/morse.js
 */

/**
 * @summary   Make your own blinker!
 *
 * @param     {String}                parser    The name of the parser - method of this name will be
 *                                              added to {@link LEDController LEDController's}
 *                                              prototype
 * @param     {LEDController.Parser}  handler   The actual parser function
 * @return    {void}
 */
LEDController.register = function register (parser, handler) {

  // Make sure handler is really a function
  if (typeof handler !== 'function')
    throw new Error(fmt('Handler must be a function, %s given', typeof handler))

  // Make sure this function is not already on the prototype
  if (LEDController.prototype[parser])
    throw new Error(fmt('Property/function: \'%s\' already defined on prototype', parser))

  LEDController.prototype[parser] = function customParser (input, done) {

    var emptyCallback = normaliseCallback()   // This will be fun!
      , data

    try {
      // Summon the handler to do the master's bidding
      data = handler(input)
    } catch (e) {
      // If we have a callback, we should always call it in next tick
      if (typeof done === 'function')
        return setImmediate(done, e)

      // No callback -> no mercy!
      throw e
    }

    // Normalise
    data = data instanceof Array ? data
                                 : [data]

    // Push the data to the blinker queue
    for (var i in data)
      // Call the callback only once, when the very last blink event has been processed
      if (data.length > i + 1)
        this.blinker.push(data[i], emptyCallback)
      else
        this.blinker.push(data[i], done)

    return this
  }
}


/**
 * @summary   Set the LED's trigger
 *
 * @param     {String}      value     The trigger to be used, as available in
 *                                    {@link LEDController#triggers|triggers' all property}
 * @param     {Function}    done      Optional callback (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.trigger = function trigger (value, done) {

  var that = this   // scope
  done = normaliseCallback(done)    // Normalise because we might need to call it from here

  // Is this trigger supported in the LED?
  if (! ~ this.triggers.all.indexOf(value))
    // It's not! You will witness your mistake... in the next event loop!
    setImmediate(done, new Error(fmt('Unsupported trigger: \'%s\' for LED %s', value, that.id)))
  else
    // Good to go - let's write the trigger to filesystem
    this.writer.push({ to: 'trigger', data: value }, done)

  // Always return even if there's error above so that we do not mask the real error by killing the
  // process with "unable to read property of undefined"
  return this
}

/**
 * @summary   Set the LED's brightness to desired value
 *
 * @desc      The integer value must be from the supported range (min <= value <= max).
 *
 * @param     {Number}      value     The new brightness to be set
 * @param     {Function}    done      Optional callback (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.setBrightness = function setBrightness (value, done) {

  // Normalise value - ensure value is an integer and within acceptable range
  value = Number.parseInt(value)
  value = value <= this.brightness.min ? this.brightness.min
                                       : Math.min(value, this.brightness.max)

  this.writer.push({ to: 'brightness', data: value }, done)

  return this
}

/**
 * @summary   Conjure photons (Turn the LED on)
 *
 * @param     {Function}    done      Optional callback (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.turnOn = function turnOn (done) {

  this.setBrightness(this.brightness.max, done)

  return this
}

/**
 * @summary   Stop conjuring photons (Turn the LED off)
 *
 * @param     {Function}    done      Optional callback (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.turnOff = function turnOff (done) {

  this.setBrightness(this.brightness.min, done)

  return this
}

/**
 * @summary   A Blink describes a blink event
 *
 * @typedef   {Object}      LEDController.Blink
 * @property  {Number}      rate      Override {@link LEDController.RATE default rate} of blinking
 * @property  {Number}      for       For how much percent of Blink.of should the LED be turned on?
 * @property  {Number}      of        What is the total duration of the blink (on + off time)
 */

/**
 * @summary   Blink the LED!
 *
 * @param     {LEDController.Blink}   opts      Provide some info about how the LED should blink
 * @param     {Function}              done      Optional callback
 *                                              (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.blink = function blink (opts, done) {

  this.blinker.push(opts, done)

  return this
}

/**
 * @summary   Remove any blink events possibly scheduled and turn the LED off
 *
 * @param     {Function}    done      Optional callback (if omitted, it will throw on error)
 * @return    {this}
 */
LEDController.prototype.reset = function reset (done) {

  this.blinker.kill()
  this.writer.kill()
  this.turnOff(done)

  return this
}

/**
 * @summary   Override default .toString() function to return proper class name
 *
 * @return    {String}      If not called from a subclass, returns [object LEDController]
 */
LEDController.prototype.toString = function toString () {

  return fmt('[object %s]', this.constructor.name)
}

/**
 * @summary   Override default .valueOf() to return current brightness
 *
 * @desc      This implementation is currently experimental and feedback on its usability is very
 *            welcome. It does, however, kind of make sense - a "value" of a LED could only be
 *            represented by either its colour or brightness (or a combination thereof). And colour
 *            we do not support.
 *            **Note: this function blocks the proces while reading current brightness.**
 *
 * @return    {Number}      LED's current brigthness
 */
LEDController.prototype.valueOf = function valueOf () {

  return this.brightness.cur
}


/**
 * @summary   Turn regular text into morse code emitted from your LED
 *
 * @desc      This method is implemented using the {@link LEDController.Parser Parser} and attached
 *            to LEDController's prototype using {@link LEDController.register}.
 *
 * @method    LEDController#morse
 * @param     {String}      input     The text to be morse-coded
 * @param     {Function}    done      Optional callback called at the end of sequence
 * @return    {this}
 */
LEDController.register('morse', morse)


// Helper functions

/**
 * @summary   Read the content of a file within base, sync
 *
 * @private
 * @param     {String}      base      The base path where to look for file
 * @param     {String}      file      File path relative to base
 * @return    {String}      The file's contents as UTF-8, trimmed
 */
function contentOf (base, file) {

  return fs.readFileSync(path.join(base, file), 'utf8').trim()
}

/**
 * @summary   Read the content of the /trigger file for a particular LED and parse trigger
 *            information (available triggers & currently selected trigger)
 *
 * @private
 * @param     {String}      location  LED's location on the filesystem
 * @return    {Object}      The trigger info for this LED (`{ all: Array, cur: String }`)
 */
function getTriggerData (location) {

  // Get available triggers for this LED
  var triggers =
      { all: contentOf(location, 'trigger').split(' ')
      , cur: undefined    // In a moment...
      }

  // Find currently set trigger (looks like [this] <- note the brackets)
  for (var i in triggers.all)
    if (triggers.all[i][0] === '[') {   // Gotcha!
      triggers.cur = triggers.all[i].replace(/[\[\]]/g, '')   // Remove the surrounding []
      triggers.all[i] = triggers.cur    // Also remove the [] from the list of all triggers
      break   // Nothing more to do, GTFO
    }

  return triggers
}

/**
 * @summary   Normalise an optional callback into actual function
 *
 * @desc      Some LEDController's methods have their callbacks optional. To ensure we actually have
 *            something we can call we pass the optional callback into this function which checks
 *            if the handler is a function and if it's not, it will provide us with a generic error
 *            handler (which throws on error, in an async call. Yeah, what better to do.)
 *
 * @private
 * @param     {mixed}       handler   The original function, or undefined. Or null. Or whatever.
 * @return    {Function}    A function that can be called with optional error object
 */
function normaliseCallback (handler) {

  if (typeof handler === 'function')
    return handler

  return function unforgivingCallback (err) {

    if (err)
      throw err   // Got error! What do we do? We panic!
  }
}

/**
 * @summary   Worker function used to control the blinking of the LED
 *
 * @private
 * @param     {LEDController.Blink}   opts    The object describing the blink event
 * @param     {Function}              done    Optional callback (if omitted, it will throw on error)
 * @return    {void}
 */
function blinkWorker (opts, done) {
  /* jshint validthis:true */   // We are binding this function to current instance in constructor

  opts = opts || {}
  done = normaliseCallback(done)

  var that = this   // scope
    // Some scientific calculations follow...
    , rate = opts.rate || LEDController.RATE
    , coef = opts.for >= 0 ? opts.for : 50
    , of = (opts.of >= 0 ? opts.of : 1000) / rate
    // Translate percentages to actual times
    , timeOn = of / 100 * coef
    , timeOff = of - timeOn

  function nextStep (next, time) {

    return function nextStepHandler (err) {

      if (err)
        return next(err)

      setTimeout(next, time)
    }
  }

  async.series(
    // Turn the LED on for timeOn miliseconds
    { on: function blinkOn (next) {

        // Special case: timeOn === 0
        if (timeOn === 0)
          // Do not even turn the led on
          return next()

        that.turnOn(nextStep(next, timeOn))
      }

    // Turn the LED off for timeOff miliseconds
    , off: function blinkOff (next) {

        that.turnOff(nextStep(next, timeOff))
      }
    }
  , done
  )
}

/**
 * @summary   Ensures that write operations to fs take place in the intended order
 *
 * @private
 * @param     {Object}      opts      Should contain enough information to perform a file write
 * @param     {String}      opts.to   Target file to be written to
 * @param     {mixed}       opts.data Data to be written to the file
 * @param     {Function}    done      Called when the operation has been completed
 * @return    {void}
 */
function writeWorker (opts, done) {
  /* jshint validthis:true */   // We are binding this function to current instance in constructor

  fs.writeFile(path.join(this.location, opts.to), opts.data, 'utf8', normaliseCallback(done))
}
