# ledctl

[![NPM Version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Coverage Status][coveralls-badge]][coveralls-url]
![Built with GNU Make][make-badge]

> Control your LEDs from Node.js

This module allows you to take control of your LEDs on whatever board you are running it, as long as the board has some LEDs that can be controlled (and the OS is aware of them).

I wanted to push my limits a little so even though it seems a trivial task to turn a light on/off, I implemented this thing with almost scientific precision - floating-point timing accuracy, race condition prevention, filesystem operations queueing, excellent error handling etc. but not at the cost of usability and simplicity. Simply put, I had a blast writing this and I hope you enjoy it, too! :)

Currently you can:

- [x] Discover available LEDs on your system
- [x] Turn on/off the LEDs
- [x] Change the LED's trigger settings
- [x] Blink the LEDs
- [x] Make your LEDs blink in morse code!
- [ ] Monitor the progress of the blink events via event listeners (considering)
- [ ] Control your LEDs from the terminal (planned)

## Installation Instructions

Install the module via npm: `npm install ledctl`

## Requirements

Currently only Linux-based operating systems are known to be supported. PRs are always welcome if you discover more operating systems where LEDs are exposed via the filesystem (usually in */sys/class/leds* but this can be overriden if the OS uses a different path).

I am aware of Raspberry-Pi, Banana-Pi and BeagleBone having user-controllable LEDs, but I am quite sure there's many more.

## Usage

Here's a crash course. I suggest you read the API docs afterwards - it contains all the information you may need to work with this library.

A quick hint - all callbacks are optional. However, if there's a problem writing to the LED's sysfs filesystem the function will throw on you.

**Great benefit** of this library is that you can simply chain calls to the LED however you wish and all the blinks will be queued and processed in the order you wanted - there's **no need to introduce a callback hell** just to blink out *SOS* in morse code.

```js
var LEDController = require('ledctl')

// Which LEDs can be controlled?
console.log(LEDController.discover())

var led = new LEDController('green')
led.turnOn() // It should be on!
led.blink() // It should blink for 500ms by default
led.blink(
// Everything below is optional - these values represent defaults
// (except rate - rate defaults to 1)
  { for: 50 // percent of total blink time
    of: 1000 // milliseconds (total blink time)
    rate: 2 // Make it all twice as fast
  }
)

// Holy grail
led.morse('sos') // Watch the awesomeness!
```

## Extending the API

You may want to implement your own method that takes arbitrary input and generates (or not) photons via your LED! For example, you may want to take a Buffer and turn the LED on every time the bit changes... Or take a string and blink when there's a vowel... Or whatever - you can do it all!

It's rather simple - first, you need to write your **serialiser**. A serialiser takes two arguments - an input value (this is what should be converted to blink events - most likely some kind of string) and a callback function which you should call with an optional Error object (or null if no error) and an array of *Blink* events.

I highly suggest that you take a look at how the morse code method is implemented in *serialisers/morse.js*.

## Documentation

Documentation is available at http://dreamscapes.github.io/ledctl

To generate documentation locally, run `make docs` from the repository's root.

## License

This software is licensed under the **BSD-3-Clause License**. See the [LICENSE](LICENSE) file for more information.

[npm-badge]: https://badge.fury.io/js/ledctl.svg
[npm-url]: https://npmjs.org/package/ledctl
[travis-badge]: https://travis-ci.org/Dreamscapes/ledctl.svg
[travis-url]: http://travis-ci.org/Dreamscapes/ledctl
[coveralls-badge]: https://coveralls.io/repos/Dreamscapes/ledctl/badge.png?branch=develop
[coveralls-url]: https://coveralls.io/r/Dreamscapes/ledctl
[make-badge]: https://img.shields.io/badge/built%20with-GNU%20Make-brightgreen.svg
