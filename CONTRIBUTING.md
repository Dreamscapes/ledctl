# Contribution Guidelines

## Run the linter

Always check if your code passes **eslint** linting: `make lint`

## Make use of .editorconfig

See [EditorConfig][editorconfig] for more details.

## Write tests

Seriously. No one will want to debug that superawesome feature you wrote that broke in next release...

To run the tests: `make test`

## Do not use semicolons

Why would you use something that's optional and does not bring any real value...?!

> Sometimes a semicolon is inevitable; see the *ledcontroller.spec.js* file for a valid example (search for them - there are only two at the time of this writing).

## Include comments and docblocks

Undocumented code is only half the job done. Don't be lazy and write **helpful** comments!

## Try to match current code style

I'm not gonna bite you if you don't, but... give it a try. :)

Usually there's a following pattern that I try to adhere to whenever possible:

1. Initialise and normalise variables (i.e. `var value = input || 'default'`)
1. Validate input & check for known mistakes (i.e. `if (! input) return`), try to return/throw as soon as possible instead of `else` branches
1. Perform logic as necessary, follow previous points within this logic, too
1. Sanitise output as necessary and return

Better check the source files, maybe it will make more sense...!

## Final thoughts

- Try to keep it simple
- Try to keep it readable
- Use meaninfgul var/method names
- Use [Lodash][lodash-docs] & [Async][async] when it makes sense, they are included (but prefer native JS for simple stuff like `.forEach()`)
- If in doubt, ask
- If you have suggestions how to improve the contributing guidelines, I'm all ears!

Thanks for reading! Looking forward to accept your awesome PR!

[editorconfig]: http://editorconfig.org
[lodash-docs]: https://lodash.com/docs
[async]: https://github.com/caolan/async
