#!/usr/bin/env node
var raml2html = require('raml2html')

function die(message) {
    console.error(message)
    process.exit(1)
}

var args = process.argv.slice(2)
if (args.length !== 1) {
    die('Expected one argument: input RAML file')
}

function template(x) {
    return path.join(__dirname, 'templates', x)
}

var input = args[0]
var https = true
var config = raml2html.getDefaultConfig(
    https,
    template('template.handlebars'),
    template('resource.handlebars'),
    template('item.handlebars')
)

raml2html.render(
    input,
    config,
    function(result) { process.stdout.write(result) },
    function(error) { die('Error parsing: ' + error) }
)
