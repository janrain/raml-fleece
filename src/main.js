#!/usr/bin/env node
var _ = require('lodash')
var marked = require('marked')
var handlebars = require('handlebars')
var raml = require('raml-parser')
var path = require('path')
var fs = require('fs')
var pkg = require('../package.json')

function die(message) {
    console.error(message)
    process.exit(1)
}

var args = process.argv.slice(2)
if (args.length !== 1) {
    die('Expected one argument: input RAML file')
}
var input = args[0]

function loadTemplate(x) {
    var f = path.join(__dirname, '..', 'templates', x + '.handlebars')
    return fs.readFileSync(f, 'utf-8')
}

function flattenHierarchy(root) {
    var title = root.title
    var traits = traitsToObject(root.traits)
    var resources = flattenResources(root, root.traits)
    return {
        title: root.title,
        traits: traits,
        resources: resources
    }
}

function traitsToObject(traits) {
    return _.reduce(traits, function(acc, obj) {
        var key = Object.keys(obj)[0]
        acc[key] = obj[key]
        return acc
    }, {})
}

function flattenResources(res, traits) {
    var xs = []
    function recur(parents, res) {
        if (!res) {
            return
        }
        var clean = _.extend({}, res)
        delete clean.resources
        clean.methods = flattenMethods(res.methods)
        clean.basePath = _.pluck(parents, 'relativeUri').join('')
        clean.path = res.relativeUri
        xs.push(clean)
        var newParents = parents.concat([res])
        _.forEach(res.resources, function(r) {
            recur(newParents, r)
        })
    }
    recur([], res)
    return xs
}

// RAML nests its structure very heavily. This function attempts to pull it
// apart, but is not very pretty. I'm sorry.
//
// Brian Mock (2015-05-29)
function flattenMethods(methods) {
    return _.map(methods, function(objForMethod) {
        var obj = _.extend({}, objForMethod)
        var methodName = objForMethod.method
        obj.responses = _.map(objForMethod.responses, function(objForCode, code) {
            var obj = {}
            _.forEach(objForCode, function(objForBody, body) {
                _.forEach(objForBody, function(objForRespType, respType) {
                    obj.example = objForRespType.example
                    obj.code = code
                    obj.method = methodName
                })
            })
            return obj
        })
        return obj
    })
}

function write(x) {
    process.stdout.write(x)
}

function parseFail(error) {
    die('Error parsing: ' + error)
}

var config = {
    version: pkg.version
}

function set(k, v) {
    return function(o) {
        o[k] = v
        return o
    }
}

var index = loadTemplate('index')
var resource = loadTemplate('resource')
var tableOfContents = loadTemplate('table_of_contents')

var resourceTemplate = handlebars.compile(resource)

handlebars.registerPartial('resource', resource)
handlebars.registerPartial('table_of_contents', tableOfContents)

handlebars.registerHelper('emptyResourceCheck', function(options) {
    if (this.methods || (this.description && this.parentUrl)) {
        return options.fn(this);
    }
})

handlebars.registerHelper('upper_case', function(s, options) {
    return s.toUpperCase()
})

handlebars.registerHelper('print_json', function(data, options) {
    return new handlebars.SafeString(
        '<script>this.D='
        + JSON.stringify(data, null, 2)
        + ';console.log(D);</script>'
    )
})

handlebars.registerHelper('json', function(data, options) {
    return new handlebars.SafeString(
        '<pre><code>'
        + JSON.stringify(data, null, 2)
        + '</code></pre>'
    )
})

handlebars.registerHelper('json_from_string', function(data, options) {
    return new handlebars.SafeString(
        '<pre><code>'
        + JSON.stringify(JSON.parse(data), null, 2)
        + '</code></pre>'
    )
})

handlebars.registerHelper('markdown', function(md, options) {
    return md ? new handlebars.SafeString(marked(md)) : ''
})

var toHtml = handlebars.compile(index)

function throwLater(e) {
    setTimeout(function() {
        throw e
    }, 0)
}

raml
    .loadFile(input)
    .catch(parseFail)
    .then(flattenHierarchy)
    .then(set('config', config))
    .then(toHtml)
    .then(write)
    .catch(throwLater)
