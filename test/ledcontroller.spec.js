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

var fs = require('fs')
  , path = require('path')
  , domain = require('domain')
  , LEDController = require('../lib/ledcontroller')
  // List of some triggers usually found on LEDs
  , knownTriggers =
    [ 'none'
    , 'timer'
    , 'heartbeat'
    , 'default-on'
    ]
  , led   // Used for ad-hoc object construction
  , ledGreen

// Get the path to given file belonging, optionally, to the specified LED (otherwise the green
// one is used)
function pathTo (file, ledId) {

  ledId = ledId || 'green:led0'

  return path.join(__dirname, 'fakeleds', ledId, file)
}

// Helper function that restores the /triggers file to a known state
function restoreTriggers () {

  var triggers = knownTriggers.slice() // Shallow copy, that's all we need
  triggers[0] = '[' + triggers[0] + ']' // Mark the first trigger as being active
  fs.writeFileSync(pathTo('trigger'), triggers.join(' ') + '\n', 'utf8')
}

// Helper function that restores the /brightness file to a known state
function restoreBrightness () {

  fs.writeFileSync(pathTo('brightness'), '0\n', 'utf8')
}


describe('LEDController', function () {

  beforeEach(function () {
    // Override the default root path for LEDs so we can predictably test this thing...
    LEDController.ROOT = path.join(__dirname, 'fakeleds')
    ledGreen = new LEDController('green:led0')
  })

  it('should throw when more LEDs are available and no identifier given', function () {
    void function () {
      led = new LEDController()
    }.should.throw()
  })

  it('should throw when trying to control non-existent LED', function () {
    void function () {
      led = new LEDController('ifeellucky')
    }.should.throw()
  })

  it('should not throw when only one LED is available and no identifier given', function () {
    // Monkey-patching
    var discoverFunc = LEDController.discover
    LEDController.discover = function () {
      return ['green:led0']   // Only one LED available on this system...
    }

    try {
      led = new LEDController()
    } finally {
      // This try/finally block is here just to make sure we get a chance to restore the function
      LEDController.discover = discoverFunc
    }

    led.id.should.equal('green:led0')
  })

  it('should have property RATE equal to 1', function () {
    LEDController.RATE.should.equal(1)
  })


  describe('property:id', function () {

    it('should be what is passed to the constructor (the LED\'s actual ID)', function () {
      ledGreen.id.should.equal('green:led0')
    })
  })


  describe('property:location', function () {

    it('should be combination of LEDController.ROOT and LED\'s identifier', function () {
      ledGreen.location
        .should.be.String
        .and.equal(path.join(LEDController.ROOT, 'green:led0'))
    })
  })

  describe('property:brightness', function () {

    afterEach(restoreBrightness)

    it('should have property min and equal 0', function () {

      ledGreen.brightness.min
        .should.be.Number
        .and.equal(0)
    })

    it('should have property max and equal to /max_brightness', function () {
      var contents = fs.readFileSync(
        pathTo('max_brightness')
      , 'utf8'
      ).trim()

      ledGreen.brightness.max
        .should.be.Number
        .and.equal(Number.parseInt(contents))
    })

    it('should have property cur and equal to /brightness', function () {
      var contents = fs.readFileSync(
        pathTo('brightness')
      , 'utf8'
      ).trim()

      ledGreen.brightness.cur
        .should.be.Number
        .and.equal(Number.parseInt(contents))
    })

    it('should reflect runtime changes in brightness.cur', function () {
      var original = Number.parseInt(fs.readFileSync(
        pathTo('brightness')
      , 'utf8'
      ).trim())
      , modified = 100

      // Just making sure we are REALLY changing the value... Ya ne'er know
      original.should.not.equal(modified)

      // Modify the brightness and check if the property updated the value, too
      fs.writeFileSync(
        pathTo('brightness')
      , modified.toString(), 'utf8'
      )

      ledGreen.brightness.cur.should.equal(100)
    })
  })


  describe('property:triggers', function () {

    afterEach(restoreTriggers)

    it('should have property all and equal to /trigger', function () {
      ledGreen.triggers.all.should.containDeep(knownTriggers)
    })

    it('should have property cur and equal to currently selected trigger in /trigger', function () {
      var current = '[' + ledGreen.triggers.cur + ']'
        , contents = fs.readFileSync(pathTo('trigger'), 'utf8')

      contents.indexOf(current).should.not.equal(- 1)
    })

    it('should reflect runtime changes in triggers.cur', function () {
      var modified = knownTriggers.slice() // shallow copy

      ledGreen.triggers.cur.should.not.equal(3) // Are we actually changing stuff?

      modified[3] = '[' + modified[3] + ']' // I just randomly chose 3.
      fs.writeFileSync(pathTo('trigger'), modified.join(' ') + '\n', 'utf8')

      ledGreen.triggers.cur.should.equal(knownTriggers[3])
    })
  })


  describe(':discover()', function () {

    it('should list the LEDs available in LEDController.ROOT', function () {
      var contents = fs.readdirSync(LEDController.ROOT)

      LEDController.discover()
        .should.be.Array
        .and.containDeep(contents)
    })

    it('should recognise valid LEDs and ignore random folders', function () {
      LEDController.ROOT = __dirname    // Set the root to the test dir

      // There are no real LEDs in the test folder!
      LEDController.discover()
        .should.be.Array
        .and.have.lengthOf(0)
    })

    it('should not throw when no LEDs are available and return empty array', function () {
      var retVal

      void function () {
        LEDController.ROOT = '/some/random/junk'
        retVal = LEDController.discover()
      }.should.not.throw()

      retVal.should.be.empty
    })
  })


  describe(':register()', function () {

    afterEach(function () {
      // Cleanup
      delete LEDController.prototype.dummymethod
    })

    it('should accept functions as handlers', function () {
      void function () {
        LEDController.register('dummymethod', function () {})
      }.should.not.throw()
    })

    it('should throw on handlers not being functions', function () {
      void function () {
        LEDController.register('dummymethod', 'ladida')
      }.should.throw()

      void function () {
        LEDController.register('dummymethod', 42)
      }.should.throw()

      void function () {
        LEDController.register('dummymethod', undefined)
      }.should.throw()
    })

    it('should put the handler onto the prototype', function () {
      function handler () {}

      LEDController.register('dummymethod', handler)

      LEDController.prototype.dummymethod
        .should.be.a.Function
        .and.should.not.equal(handler)    // Because we wrap it in our own function
    })

    it('should throw when attempting to register the same handler more than once', function () {
      // This should pass - registering it for the first time...
      void function () {
        LEDController.register('dummymethod', function () {})
      }.should.not.throw()
      // And here it should throw
      void function () {
        LEDController.register('dummymethod', function () {})
      }.should.throw()
    })

    it('should call the handler when calling the attached method', function (done) {
      function handler (input) {
        input.should.equal('test')

        setImmediate(done)
      }

      LEDController.register('dummymethod', handler)
      ledGreen.dummymethod('test')
    })

    it('should pass all errors thrown from handlers to the method callback', function (done) {
      // Simple asynchrony test - see assertion below
      var ticked = false

      LEDController.register('dummymethod', function () {
        // Imagine an error in my custom serialiser happened...
        throw new Error('test')
      })

      ledGreen.dummymethod('input', function (err) {
        err.message.should.equal('test')
        ticked.should.equal(true, 'In callbacks, handler errors should be delivered in next tick')
        done()
      })

      ticked = true
    })

    it('should throw if handler throws and no callback has been provided', function () {
      LEDController.register('dummymethod', function () {
        // Imagine an error in my custom serialiser happened...
        throw new Error('test')
      })

      void function () {
        ledGreen.dummymethod('input')
      }.should.throw('test')
    })

    it('should call the callback only once, even if more blinks are in queue', function (done) {
      LEDController.register('dummymethod', function () {
        // Just two superfast blink events...
        return [{ rate: 10000 }, { rate: 10000 }]
      })

      // Mocha will surely complain about calling done multiple times
      ledGreen.dummymethod('test', done)
    })

    it('should make the attached function to return this', function () {
      LEDController.register('dummymethod', function () {})

      ledGreen.dummymethod().should.be.exactly(ledGreen)
    })
  })


  describe('.trigger()', function () {

    afterEach(restoreTriggers)

    it('should write the desired trigger to /trigger', function (done) {
      ledGreen.trigger('default-on', function () {
        fs.readFileSync(pathTo('trigger'), 'utf8').trim().should.equal('default-on')

        done()
      })
    })

    it('should return this', function (done) {
      ledGreen.trigger('default-on', done).should.be.exactly(ledGreen)
    })

    it('should error out on invalid trigger name', function (done) {
      ledGreen.trigger('something', function (err) {

        err.should.be.Error
        err.message.should.containEql('something')

        done()
      })
    })

    it('should throw on error when no callback given', function (done) {
      // Warning - fragile test! If it fails, it crashes the whole test suite. Not sure what
      // exactly is going on or how to fix it... Just FYI.
      var d = domain.create()

      d.on('error', function (err) {
        err.should.be.an.Error
        err.message.should.containEql('Unsupported trigger')

        done()
      })

      d.run(function () {
        ledGreen.trigger('something')
      })
    })
  })


  describe('.turnOn() / .turnOff()', function () {

    afterEach(restoreBrightness)

    it('.turnOn() should write to /brightness its maximum brightness', function (done) {
      ledGreen.turnOn(function () {
        var contents = fs.readFileSync(pathTo('brightness'), 'utf8').trim()
          , maxBrightness = fs.readFileSync(pathTo('max_brightness'), 'utf8').trim()

        contents.should.equal(maxBrightness)
        done()
      })
    })

    it('.turnOn() should return this', function (done) {
      ledGreen.turnOn(done).should.be.exactly(ledGreen)
    })

    it('.turnOff() should write to /brightness 0', function (done) {
      ledGreen.turnOff(function () {
        var contents = Number.parseInt(fs.readFileSync(pathTo('brightness'), 'utf8').trim())

        contents.should.equal(0)
        done()
      })
    })

    it('.turnOff() should return this', function (done) {
      ledGreen.turnOff(done).should.be.exactly(ledGreen)
    })
  })


  describe('.setBrightness()', function () {

    afterEach(restoreBrightness)

    it('should write to /brightness the desired brightness', function (done) {
      ledGreen.setBrightness(100, function () {
        // We don't have to look at fs because we have a test that verifies this property being
        // realtime :)
        ledGreen.brightness.cur.should.equal(100)
        done()
      })
    })

    it('should work with string-like integers', function (done) {
      ledGreen.setBrightness('100', function () {

        ledGreen.brightness.cur.should.equal(100)
        done()
      })
    })

    it('should prevent negative brightness and set it to 0', function (done) {
      ledGreen.setBrightness(- 10, function () {

        ledGreen.brightness.cur.should.equal(0)
        done()
      })
    })

    it('should prevent brightness higher than maximum supported', function (done) {
      ledGreen.setBrightness(1000, function () {

        ledGreen.brightness.cur.should.equal(ledGreen.brightness.max)
        done()
      })
    })

    it('should return this', function (done) {
      ledGreen.setBrightness(100, done).should.be.exactly(ledGreen)
    })
  })


  describe('.reset()', function () {

    // Because the mocked file contains newline and we do not care about such things in actual
    // implementation
    after(restoreBrightness)

    it('should cancel all queued events and their associated callbacks', function (done) {
      ledGreen.turnOn(function () {
        done(new Error('Expected .turnOn() to be cancelled, but its callback was called'))
      })
      .reset(done)
    })

    it('should turn the LED off', function (done) {
      ledGreen.turnOn(function () {
        ledGreen.reset(function () {
          ledGreen.brightness.cur.should.equal(0)

          done()
        })
      })
    })

    it('should return this', function (done) {
      ledGreen.reset(done).should.be.exactly(ledGreen)
    })
  })


  describe('.blink()', function () {

    // TODO
  })


  describe('.toString()', function () {

    it('should return proper object class name', function () {
      ledGreen.toString().should.equal('[object LEDController]')
    })
  })


  describe('.valueOf()', function () {

    it('should return the LED\'s current brightness', function () {
      ledGreen.valueOf().should.equal(ledGreen.brightness.cur)
    })
  })
})
