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



var input = args[0]
var https = true
var config = raml2html.getDefaultConfig(
    https,
    './templates/template.handlebars',
    './templates/resource.handlebars',
    './templates/item.handlebars'
)

raml2html.render(
    input,
    config,
    function(result) { process.stdout.write(result) },
    function(error) { die('Error parsing: ' + error) }
)
