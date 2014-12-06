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

var morse = require('../lib/serialisers/morse')
  , should = require('should')


describe('Morse code serialiser', function () {

  it('should produce series of Blink objects', function (done) {
    morse('a', function (err, blinks) {
      should(err).equal(null)
      blinks.length.should.equal(2)

      // First Blink
      blinks[0].for.should.equal(50)
      // Second Blink
      blinks[1].for.should.equal(75)
      blinks[1].of.should.equal(2000)

      done()
    })
  })

  it('should insert letter break between two letter codes', function (done) {
    morse('ab', function (err, blinks) {
      // 0 -> ., 1 -> _, 2 -> expected letter break
      blinks[2].for.should.equal(0)
      blinks[2].of.should.equal(500)

      done()
    })
  })

  it('should not put letter break at the end of sequence', function (done) {
    morse('ab c', function (err, blinks) {
      blinks.length.should.equal(12)    // ._l_...w_._.; l -> letter break, w -> word break
      blinks[blinks.length - 1].for.should.not.equal(0)

      done()
    })
  })

  it('should insert word break on space', function (done) {
    morse('a b', function (err, blinks) {
      // 0 -> ., 1 -> _, 2 -> expected word break (a space)
      blinks[2].for.should.equal(0)
      blinks[2].of.should.equal(3500)

      done()
    })
  })
})
