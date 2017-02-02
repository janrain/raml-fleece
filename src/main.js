#!/usr/bin/env node
'use strict';

// TODO: Show headers.
// TODO: Show HTTPS.
// TODO: Show OAuth.
// TODO: Show query parameter enums.
// TODO: Show query parameter default values.

var _ = require('lodash');
var raml = require('raml-parser');
var pkg = require('../package');
var toHtml = require('./to-html').toHtml;
const argv = require('./cmdline').argv

const input = argv._[0]

var config = {
  version: pkg.version
};

// Print error and exit 1 so we can break automated builds and such.
function die(message) {
  console.error(message);
  process.exit(1);
}

function makeSafeIdString(path) {
  return path
    .replace(/^[\/\s\.]|[\{\}]/g, '')
    .replace(/[\/\s\.]+/g, '-')
    .toLowerCase();
}

// Flatten RAML's nested hierarchy of traits and resources.
function flattenHierarchy(root) {
  var traits = arrayOfObjectsToObject(root.traits);
  var resources = flattenResources(root, root.traits);
  var securitySchemes = arrayOfObjectsToObject(root.securitySchemes);
  var obj = {
    baseUri: root.baseUri,
    baseUriParameters: root.baseUriParameters,
    documentation: (root.documentation || []).map(x => {
      return {
        title: x.title,
        content: x.content,
        docId: makeSafeIdString(x.title)
      }
    }),
    title: root.title,
    traits: traits,
    version: root.version,
    resources: resources
  };
  if (!_.isEmpty(securitySchemes)) {
    obj.securitySchemes = securitySchemes;
  }
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
    clean.basePath = _.map(parents, 'relativeUri').join('');
    clean.path = res.relativeUri;
    clean.fullPath = clean.basePath + clean.path;
    clean.pathId = makeSafeIdString(clean.fullPath)
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
    if (key === 'application/x-www-form-urlencoded') {
      return {
        type: key,
        params: val.formParameters
      };
    }
    return {
      type: _.isString(key) ? key : undefined,
      example: val ? val.example : undefined,
      schema: val ? val.schema : undefined
    };
  });
}

// Flattens the various methods defined on a resource, so we can have a list at
// the end, making it easy for the template.
function flattenMethods(methods) {
  return _.map(methods, function(objForMethod) {
    var obj = _.extend({}, objForMethod);
    var responses = objForMethod.responses;
    obj.requestExamples = makeExamplesOf(obj);
    obj.responses = _.map(responses, function(objForCode, code) {
      objForCode = objForCode || {};
      var obj = {};
      obj.code = code;
      obj.method = objForMethod.method;
      obj.headers = objForCode.headers;
      obj.description = objForCode.description;
      obj.examples = makeExamplesOf(objForCode);
      return obj;
    });
    return obj;
  });
}

// Ensure that uncaught exceptions are eventually shown in the console.
function throwLater(e) {
  setTimeout(function() { throw e; }, 0);
}

const templates = _.chain(argv)
  .pick([
    'template-documentation',
    'template-index',
    'template-before-main',
    'template-main',
    'template-after-main',
    'template-parameters',
    'template-resource',
    'template-securityScheme',
    'template-tableOfContents',
    'template-after-tableOfContents',
  ])
  .pickBy(_.isString)
  .mapKeys((value, key) => _.replace(key, 'template-', ''))
  .value()

const styles = _.chain(argv)
  .pick([
    'style-before',
    'style',
    'style-after'
  ])
  .pickBy(_.isString)
  .value()

// Load the RAML and output the HTML.
raml
  .loadFile(input)
  .catch(e => die('Error parsing: ' + e))
  .then(flattenHierarchy)
  .then(obj => _.extend(obj, {config: config}))
  .then(toHtml(argv.bare, argv.postmanId, templates, styles))
  .then(x => process.stdout.write(x))
  .catch(throwLater);
