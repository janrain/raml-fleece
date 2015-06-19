#!/usr/bin/env node
'use strict';

// TODO: Show headers.
// TODO: Show HTTPS.
// TODO: Show OAuth.
// TODO: Show query parameter enums.
// TODO: Show query parameter default values.

var _ = require('lodash');
var marked = require('marked');
var handlebars = require('handlebars');
var hljs = require('highlight.js');
var raml = require('raml-parser');
var path = require('path');
var fs = require('fs');
var pkg = require('../package');

var STATUS_CODES = require('../status-codes');

var config = {
  version: pkg.version
};

var JSON_INDENT_SIZE = 2;
function prettyJson(x) {
  return JSON.stringify(x, null, JSON_INDENT_SIZE);
}

// Print error and exit 1 so we can break automated builds and such.
function die(message) {
  console.error(message);
  process.exit(1);
}

// Load file from templates/ directory.
function loadTemplate(x) {
  var f = path.join(__dirname, '..', 'templates', x);
  return fs.readFileSync(f, 'utf-8');
}

// Flatten RAML's nested hierarchy of traits and resources.
function flattenHierarchy(root) {
  var title = root.title;
  var traits = arrayOfObjectsToObject(root.traits);
  var resources = flattenResources(root, root.traits);
  var securitySchemes = arrayOfObjectsToObject(root.securitySchemes);
  var obj = {
    baseUri: root.baseUri,
    baseUriParameters: root.baseUriParameters,
    securitySchemes: securitySchemes,
    title: root.title,
    traits: traits,
    resources: resources
  };
  return obj;
}

// Convert list of objects to an object.
function arrayOfObjectsToObject(xs) {
  return _.reduce(xs, function(acc, obj) {
    var key = Object.keys(obj)[0];
    acc[key] = obj[key];
    return acc;
  }, {});
}

// Flatten RAML's nested resources into a list of resources.
function flattenResources(res, traits) {
  var xs = [];
  function recur(parents, res) {
    if (!res) {
      return;
    }
    var clean = _.extend({}, res);
    delete clean.resources;
    clean.methods = flattenMethods(res.methods);
    clean.basePath = _.pluck(parents, 'relativeUri').join('');
    clean.path = res.relativeUri;
    clean.fullPath = clean.basePath + clean.path;
    xs.push(clean);
    var newParents = parents.concat([res]);
    _.forEach(res.resources, function(r) {
      recur(newParents, r);
    });
  }
  recur([], res);
  return _.sortBy(xs, 'fullPath');
}

// Flatten all the examples for a resource into a list, or generate a JSON body
// example based on the declared parameters, filling in junk data.
function makeExamplesOf(obj) {
  return _.map(obj.body, function(val, key) {
    return {
      type: _.isString(key) ? key : undefined,
      example: val.example,
      schema: val.schema
    };
  });
}

function stripContentTypePrefix(type) {
  if (!_.isString(type)) {
    throw new Error('not a string: ' + type);
  }
  return type.replace(/^[^\/]*\//, '');
}

// Flattens the various methods defined on a resource, so we can have a list at
// the end, making it easy for the template.
function flattenMethods(methods) {
  return _.map(methods, function(objForMethod) {
    var obj = _.extend({}, objForMethod);
    var responses = objForMethod.responses;
    obj.requestExamples = makeExamplesOf(obj);
    obj.responses = _.map(responses, function(objForCode, code) {
      var obj = {};
      obj.code = code;
      obj.method = objForMethod.method;
      obj.description = objForCode.description;
      _.forEach(objForCode.body, function(objForRespType, respType) {
        obj.type = respType;
        obj.example = objForRespType.example;
        obj.schema = objForRespType.schema;
      });
      return obj;
    });
    return obj;
  });
}

// Load all Handlebars helpers and partials.
function registerHelpersAndPartials() {
  handlebars.registerHelper('json', function(data) {
    var out = hljs.highlight('json', prettyJson(data));
    return new handlebars.SafeString(
      '<pre class="hljs lang-json"><code>' +
      out.value +
      '</code></pre>'
      );
  });
  handlebars.registerHelper('response_code', function(num) {
    var n = Math.floor(num / 100);
    var s = '' + num;
    if (num in STATUS_CODES) {
      s += ' ' + STATUS_CODES[num];
    }
    return new handlebars.SafeString(
      '<span class="response-code response-code-' + n + 'xx">' +
      handlebars.escapeExpression(s) +
      '</span>'
    );
  });
  handlebars.registerHelper('name_for_security_scheme', function(key, o) {
    return key === null ?
      'Security Optional' :
      o.data.root.securitySchemes[key].type;
  });
  handlebars.registerHelper('show_code', function(data, o) {
    if (data === undefined) {
      return '';
    }
    var lang = o.hash.type ?
      stripContentTypePrefix(o.hash.type) :
      undefined;
    var out;
    if (lang === 'json') {
      var err = '';
      try {
        data = prettyJson(JSON.parse(data));
      } catch (e) {
        err = JSON_PARSE_ERROR;
      }
      out = hljs.highlight('json', data);
      return new handlebars.SafeString(
        err +
        '<pre class="hljs lang-json"><code>' +
        out.value +
        '</code></pre>'
      );
    } else if (lang === 'html' || lang === 'xml') {
      out = hljs.highlight(lang, data);
      return new handlebars.SafeString(
        '<pre class="hljs lang-' + out.language +
        '"><code>' +
        out.value +
        '</code></pre>'
      );
    } else {
      return new handlebars.SafeString(
        '<pre><code>' +
        handlebars.escapeExpression(data) +
        '</code></pre>'
      );
    }
  });
  handlebars.registerHelper('markdown', function(md) {
    return md ? new handlebars.SafeString(marked(md)) : '';
  });
  handlebars.registerHelper('upper_case', _.method('toUpperCase'));
  handlebars.registerPartial('resource', RESOURCE);
  handlebars.registerPartial('security_scheme', SECURITY_SCHEME);
  handlebars.registerPartial('table_of_contents', TABLE_OF_CONTENTS);
  handlebars.registerPartial('style', STYLE);
  handlebars.registerPartial('parameters', PARAMETERS);
}

// Grab input RAML filename.
var args = process.argv.slice(2);
if (args.length !== 1) {
  die('Expected one argument: input RAML file');
}
var input = args[0];

// Load template files.
var INDEX = loadTemplate('index.handlebars');
var RESOURCE = loadTemplate('resource.handlebars');
var TABLE_OF_CONTENTS = loadTemplate('table_of_contents.handlebars');
var STYLE = loadTemplate('style.css');
var PARAMETERS = loadTemplate('parameters.handlebars');
var JSON_PARSE_ERROR = loadTemplate('invalid_json.html');
var SECURITY_SCHEME = loadTemplate('security_scheme.handlebars');
var toHtml = handlebars.compile(INDEX, {
  preventIndent: true
});

registerHelpersAndPartials();

function write(x) {
  process.stdout.write(x);
}

// Ensure that uncaught exceptions are eventually shown in the console.
function throwLater(e) {
  setTimeout(function() { throw e; }, 0);
}

// Load the RAML and output the HTML.
raml
  .loadFile(input)
  .catch(function(e) {
    die('Error parsing: ' + e);
  })
  .then(flattenHierarchy)
  .then(function(obj) {
    return _.extend(obj, {config: config});
  })
  .then(toHtml)
  .then(write)
  .catch(throwLater);
