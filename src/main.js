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

var config = {
  version: pkg.version
};

// Print error and exit 1 so we can break automated builds and such.
function die(message) {
  console.error(message);
  process.exit(1);
}

// Flatten RAML's nested hierarchy of traits and resources.
function flattenHierarchy(root) {
  var traits = arrayOfObjectsToObject(root.traits);
  var resources = flattenResources(root, root.traits);
  var securitySchemes = arrayOfObjectsToObject(root.securitySchemes);
  var obj = {
    baseUri: root.baseUri,
    baseUriParameters: root.baseUriParameters,
    securitySchemes: securitySchemes,
    title: root.title,
    traits: traits,
    version: root.version,
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
    if (key === 'application/x-www-form-urlencoded') {
      return {
        type: key,
        params: val.formParameters
      };
    }
    return {
      type: _.isString(key) ? key : undefined,
      example: val.example,
      schema: val.schema
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

// Grab input RAML filename.
var args = process.argv.slice(2);
if (args.length !== 1) {
  die('Expected one argument: input RAML file');
}
var input = args[0];

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
