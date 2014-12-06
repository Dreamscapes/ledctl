# Dreamscapes\ledctl
#
# Licensed under the BSD-3-Clause license
# For full copyright and license information, please see the LICENSE file
#
# @author       Robert Rossmann <rr.rossmann@me.com>
# @copyright    2014 Robert Rossmann
# @link         https://github.com/Dreamscapes/ledctl
# @license      http://choosealicense.com/licenses/BSD-3-Clause  BSD-3-Clause License

# Helper vars
BIN = node_modules/.bin/
NODE_V = $(shell node -v | cut -f1,2 -d".")

# Project-specific information
GH_USER = Alaneor
GH_REPO = dreamscapes/ledctl
# Only deploy to gh-pages from node 0.10
GH_NODE = v0.10

# Project-specific paths
LIBDIR = lib
TSTDIR = test
DOCDIR = docs
COVDIR = coverage
GHPDIR = gh-pages

# Set/override some variables for Travis

# Travis cannot access our repo using just a username - a token is necessary to be exported into
# GH_TOKEN env variable
GH_USER := $(if ${GH_TOKEN},${GH_TOKEN},$(GH_USER))
# This will usually not changes, but if someone forks our repo, this should make sure Travis will
# not try to update the source repo
GH_REPO := $(if ${TRAVIS_REPO_SLUG},${TRAVIS_REPO_SLUG},$(GH_REPO))

# Command line args for Mocha test runner
MOCHAFLAGS = --reporter spec --require should

# Default - Run it all! (except for coveralls - that should be run only from Travis)
all: install lint test coverage docs

# Install dependencies (added for compatibility reasons with usual workflows with make,
# i.e. calling make && make install)
install:
	@npm install

# Lint all js files (configuration available in .jshintrc)
lint:
	@$(BIN)jshint $(LIBDIR) $(TSTDIR) $(BENCHDIR) \
		--reporter node_modules/jshint-stylish/stylish.js

# Run tests using Mocha
test:
	@$(BIN)mocha $(MOCHAFLAGS)

# Generate coverage report (html report available in coverage/lcov-report)
coverage:
	@$(BIN)istanbul cover $(BIN)_mocha > /dev/null -- $(MOCHAFLAGS)

# Submit coverage results to Coveralls (works from Travis; from localhost, additional setup is
# necessary
coveralls: coverage
	@cat $(COVDIR)/lcov.info | $(BIN)coveralls

# Generate API documentation
docs:
	@$(BIN)jsdoc -r $(LIBDIR) README.md --destination $(DOCDIR)

# Update gh-pages branch with new docs
gh-pages: clean-gh-pages docs
ifeq ($(NODE_V), $(GH_NODE))  # Only deploy to gh-pages when node version meets requirements
	@# The commit message when updating gh-pages
	$(eval COMMIT_MSG := $(if ${TRAVIS_COMMIT},\
		"Updated gh-pages from ${TRAVIS_COMMIT}",\
		"Updated gh-pages manually"))

	@git clone --branch=$(GHPDIR) \
			https://$(GH_USER)@github.com/$(GH_REPO).git $(GHPDIR) > /dev/null 2>&1; \
		cd $(GHPDIR); \
		rm -rf *; \
		cp -Rf ../$(DOCDIR)/* .; \
		git add -A; \
		git config user.name "Travis-CI" && git config user.email "travis@travis-ci.org"; \
		git commit -m $(COMMIT_MSG); \
		git push --quiet origin $(GHPDIR) > /dev/null 2>&1;
else
	@# noop
endif

# Delete API docs
clean-docs:
	@rm -rf $(DOCDIR)

# Delete coverage results
clean-coverage:
	@rm -rf $(COVDIR)

# Clean gh-pages dir
clean-gh-pages:
	@rm -rf $(GHPDIR)

# Delete all generated files
clean: clean-docs clean-coverage clean-gh-pages

.PHONY: install lint test coveralls gh-pages clean-docs clean-coverage clean-gh-pages clean
