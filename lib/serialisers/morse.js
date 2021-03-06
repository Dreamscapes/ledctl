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

'use strict'

module.exports = toMorse

/** @private */
var signal =
    { '.': { for: 50 }              // Short blink
    , '_': { for: 75, of: 2000 }    // Long blink
    , 'w': { for: 0, of: 3500 }     // Word break
    , 'l': { for: 0, of: 500 }      // Letter break
    }
  , mapping =
    { a: '._'
    , b: '_...'
    , c: '_._.'
    , d: '_..'
    , e: '.'
    , f: '.._.'
    , g: '__.'
    , h: '....'
    , i: '..'
    , j: '.___'
    , k: '_._'
    , l: '._..'
    , m: '__'
    , n: '_.'
    , o: '___'
    , p: '.__.'
    , q: '__._'
    , r: '._.'
    , s: '...'
    , t: '_'
    , u: '.._'
    , v: '..._'
    , w: '.__'
    , x: '_.._'
    , y: '_.__'
    , z: '__..'
    , '1': '.____'
    , '2': '..___'
    , '3': '...__'
    , '4': '...._'
    , '5': '.....'
    , '6': '_....'
    , '7': '__...'
    , '8': '___..'
    , '9': '____.'
    , '0': '_____'
    , '.': '._._._'
    , ',': '__..__'
    , '?': '..__..'
    , '\'': '.____.'
    , '!': '_._.__'
    , '/': '_.._.'
    , '(': '_.__.'
    , ')': '_.__._'
    , ':': '___...'
    , ';': '_._._.'
    , '=': '_..._'
    , '+': '._._.'
    , '-': '_...._'
    , '"': '._.._.'
    , '@': '.__._.'
    , ' ': 'w'
    }

/**
 * Parse normal text into a series of blink events, representing a morse code
 *
 * @private
 * @param     {String}    input       The string to be converted into morse code
 * @return    {Array}     blinks      The resulting blink events, as converted from the input
 */
function toMorse (input) {

  return input
    .toString()
    .split('')
    // Map each character to its morse code counterpart from the mapping table
    .map(function (el, i, arr) {
        var code = mapping[el]
          , nextEl = arr[i + 1]   // Next element in the sequence

        if (code) {
          // Only add a letter break if:
          // The current symbol is not a space
          // The next symbol is not a space
          // The sequence is not about to end
          if (el !== ' ' && nextEl !== ' ' && nextEl !== undefined)
            code += 'l'

          return code
        }
        // Drop unknown characters/symbols
      })
    // Convert the array so that we again have an array of individual morse code symbols
    .join('')
    .split('')
    // Map each morse code symbol into an actual blink event/signal representing that symbol
    .map(function (el) {
        return signal[el]
      })
}
