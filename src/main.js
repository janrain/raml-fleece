#!/usr/bin/env node
var _ = require('lodash')
var marked = require('marked')
var handlebars = require('handlebars')
var hljs = require('highlight.js')
var raml = require('raml-parser')
var path = require('path')
var fs = require('fs')
var pkg = require('../package.json')

var JSON_INDENT_SIZE = 2

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
    var f = path.join(__dirname, '..', 'templates', x)
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

function makeExampleFromType(t, name) {
    if (t === "string") {
        return "EXAMPLE: " + name
    } else if (t === "number") {
        return 12344567890
    }
    throw new Error("makeExampleFromType not implemented for type " + t)
}

function tryPrettyJson(x) {
    try {
        return prettyJson(JSON.parse(x))
    } catch (e) {
        return x
    }
}

function makeExamplesOf(obj) {
    if (obj.body) {
        return _.map(_.pluck(_.values(obj.body), 'example'), tryPrettyJson)
    }
    var params = obj.params
    var obj = _.reduce(params, function(o, v) {
        var example = 'example' in v
            ? v.example
            : makeExampleFromType(v.type, v.displayName)
        _.set(o, v.displayName, example)
        return o
    }, {})
    return Object.keys(obj).length > 0
        ? [obj]
        : undefined
}

// RAML nests its structure very heavily. This function attempts to pull it
// apart, but is not very pretty. I'm sorry.
//
// Brian Mock (2015-05-29)
function flattenMethods(methods) {
    return _.map(methods, function(objForMethod) {
        var obj = _.extend({}, objForMethod)
        var methodName = objForMethod.method
        obj.requestExamples = makeExamplesOf(obj)
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

var INDEX = loadTemplate('index.handlebars')
var RESOURCE = loadTemplate('resource.handlebars')
var TABLE_OF_CONTENTS = loadTemplate('table_of_contents.handlebars')
var STYLE = loadTemplate('style.css')
var JSON_PARSE_ERROR = loadTemplate('invalid_json.html')

handlebars.registerPartial('resource', RESOURCE)
handlebars.registerPartial('table_of_contents', TABLE_OF_CONTENTS)
handlebars.registerPartial('style', STYLE)

handlebars.registerHelper('upper_case', function(s, options) {
    return s.toUpperCase()
})

function prettyJson(x) {
    return JSON.stringify(x, null, JSON_INDENT_SIZE)
}

handlebars.registerHelper('json', function(data, options) {
    var out = hljs.highlight('json', prettyJson(data))
    return new handlebars.SafeString(
        '<pre class="hljs lang-json"><code>'
        + out.value
        + '</code></pre>'
    )
})

handlebars.registerHelper('json_from_string', function(data, options) {
    if (data === undefined) {
        return ''
    }
    var err = ''
    try {
        data = prettyJson(JSON.parse(data))
    } catch (e) {
        err = JSON_PARSE_ERROR
    }
    var out = hljs.highlight('json', data)
    return new handlebars.SafeString(
        err
        + '<pre class="hljs lang-json"><code>'
        + out.value
        + '</code></pre>'
    )
})

handlebars.registerHelper('markdown', function(md, options) {
    return md ? new handlebars.SafeString(marked(md)) : ''
})

var toHtml = handlebars.compile(INDEX, {
    preventIndent: true
})

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
