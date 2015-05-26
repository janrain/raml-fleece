#!/usr/bin/env node
var raml2html = require('raml2html')
var path = require('path')

function die(message) {
    console.error(message)
    process.exit(1)
}

var args = process.argv.slice(2)
if (args.length !== 1) {
    die('Expected one argument: input RAML file')
}

function template(x) {
    return path.join(__dirname, '..', 'templates', x + '.handlebars')
}

var input = args[0]
var https = true
var config = raml2html.getDefaultConfig(
    https,
    template('index'),
    template('resource'),
    template('item')
)

raml2html.render(
    input,
    config,
    function(result) { process.stdout.write(result) },
    function(error) { die('Error parsing: ' + error) }
)
