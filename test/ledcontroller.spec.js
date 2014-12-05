/**
 * Dreamscapes\ledctl
 *
 * Licensed under the BSD-3-Clause license
 * For full copyright and license information, please see the LICENSE file
 *
 * @author     Robert Rossmann <rr.rossmann@me.com>
 * @copyright  2014 Robert Rossmann
 * @link       https://github.com/Dreamscapes/ledctl
 * @license    http://choosealicense.com/licenses/BSD-3-Clause  BSD-3-Clause License
 */

// Make jshint play nicely with should.js
/* jshint expr: true */

'use strict';

var fs = require('fs')
  , path = require('path')
  , LEDController = require('../lib/ledcontroller')
// List of some triggers usually found on LEDs
  , knownTriggers =
    [ 'none'
    , 'timer'
    , 'heartbeat'
    , 'default-on'
    ]
  , led // Used for ad-hoc object construction
  , ledGreen
  , ledRed

// Get the path to given file belonging, optionally, to the specified LED (otherwise the green
// one is used)
function pathTo(file, led) {

  led = led || 'green:led0'

  return path.join(__dirname, 'fakeleds', led, file)
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
    ledRed = new LEDController('red:led1')
  })


  it('should throw when no identifier given', function () {
    (function () {
      led = new LEDController()
    }).should.throw()
  })

  it('should throw when trying to control non-existent LED', function () {
    (function () {
      led = new LEDController('ifeellucky')
    }).should.throw()
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

    beforeEach(restoreBrightness)
    after(restoreBrightness)


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
        .and.equal(parseInt(contents))
    })

    it('should have property cur and equal to /brightness', function () {
      var contents = fs.readFileSync(
        pathTo('brightness')
      , 'utf8'
      ).trim()

      ledGreen.brightness.cur
        .should.be.Number
        .and.equal(parseInt(contents))
    })

    it('should reflect runtime changes in brightness.cur', function () {
      var original = parseInt(fs.readFileSync(
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
    after(restoreTriggers)


    it('should have property all and equal to /trigger', function () {
      ledGreen.triggers.all.should.containDeep(knownTriggers)
    })

    it('should have property cur and equal to currently selected trigger in /trigger', function () {
      var current = '[' + ledGreen.triggers.cur + ']'
        , contents = fs.readFileSync(pathTo('trigger'), 'utf8')

      contents.indexOf(current).should.not.equal(-1)
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

      (function () {
        LEDController.ROOT = '/some/random/junk'
        retVal = LEDController.discover()
      }).should.not.throw()

      retVal.should.be.empty
    })
  })


  describe(':register()', function () {

    afterEach(function () {
      // Cleanup
      delete LEDController.prototype.dummymethod
    })


    it('should accept functions as handlers', function () {
      (function () {
        LEDController.register('dummymethod', function () {})
      }).should.not.throw()
    })

    it('should throw on handlers not being functions', function () {
      (function () {
        LEDController.register('dummymethod', 'ladida')
      }).should.throw();    // Semicolon necessary... wow

      (function () {
        LEDController.register('dummymethod', 42)
      }).should.throw();

      (function () {
        LEDController.register('dummymethod', undefined)
      }).should.throw()
    })

    it('should put the handler onto the prototype', function () {
      var handler = function () {}

      LEDController.register('dummymethod', handler)

      LEDController.prototype.dummymethod
        .should.be.a.Function
        .and.should.not.equal(handler)    // Because we wrap it in our own function
    })

    it('should throw when attempting to register the same handler more than once', function () {
      // This should pass - registering it for the first time...
      (function () {
        LEDController.register('dummymethod', function () {})
      }).should.not.throw();
      // And here it should throw
      (function () {
        LEDController.register('dummymethod', function () {})
      }).should.throw()
    })

    it('should call the handler when calling the attached method', function (done) {
      var handler = function (input) {
        input.should.equal('test')

        process.nextTick(done)
      }

      LEDController.register('dummymethod', handler)
      ledGreen.dummymethod('test')
    })

    it('should pass all errors returned from handlers to the method callback', function (done) {
      LEDController.register('dummymethod', function (input, next) {
        // Imagine an error in my custom serialiser happened...
        return next(new Error('test'))
      })

      ledGreen.dummymethod('input', function (err) {
        err.message.should.equal('test')

        done()
      })
    })

    it('should call the callback only once, even if more blinks are in queue', function (done) {
      LEDController.register('dummymethod', function (input, next) {
        // Just two superfast blink events...
        return next(null, [{ rate: 10000 }, { rate: 10000 }])
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

    beforeEach(restoreTriggers)
    after(restoreTriggers)

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
  })


  describe('.turnOn() / .turnOff()', function () {

    beforeEach(restoreBrightness)
    after(restoreBrightness)

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
        var contents = parseInt(fs.readFileSync(pathTo('brightness'), 'utf8').trim())

        contents.should.equal(0)
        done()
      })
    })

    it('.turnOff() should return this', function (done) {
      ledGreen.turnOff(done).should.be.exactly(ledGreen)
    })
  })


  describe('.blink()', function () {

    // TODO
  })
})
