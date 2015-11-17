var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var hljs = require('highlight.js');
var marked = require('marked');
var handlebars = require('handlebars');

var STATUS_CODES = require('../status-codes');

var JSON_INDENT_SIZE = 2;
function prettyJson(x) {
  return JSON.stringify(x, null, JSON_INDENT_SIZE);
}

// Turns application/json into json, for example.
function stripContentTypePrefix(type) {
  if (!_.isString(type)) {
    throw new Error('not a string: ' + type);
  }
  return type.replace(/^[^\/]*\//, '');
}

// Load file from templates/ directory.
function loadTemplate(x) {
  var f = path.join(__dirname, '..', 'templates', x);
  return fs.readFileSync(f, 'utf-8');
}

handlebars.registerHelper('json', function(data) {
  var out = hljs.highlight('json', prettyJson(data));
  return new handlebars.SafeString(
    '<pre class="hljs lang-json"><code>' +
    out.value +
    '</code></pre>'
  );
});
handlebars.registerHelper('responseCode', function(num) {
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
handlebars.registerHelper('nameForSecurityScheme', function(key, o) {
  return key === null ?
    'security optional' :
    key;
});
handlebars.registerHelper('showCodeOrForm', function(data, o) {
  var ret;
  if (data.type === 'application/x-www-form-urlencoded') {
    ret = handlebars.partials.parameters({
      type: 'Form',
      params: data.params,
    });
  } else {
    ret = handlebars.helpers.showCode(
      data.example,
      {hash: {type: data.type}}
    );
  }
  return new handlebars.SafeString(ret);
});
handlebars.registerHelper('showCode', function(data, o) {
  if (!data) {
    return '';
  }
  var lang = o.hash.type ?
    stripContentTypePrefix(o.hash.type) :
    undefined;
  var out;
  // Language might be 'json' or 'hal+json'.
  if (/json$/.test(lang)) {
    var err = '';
    try {
      data = prettyJson(JSON.parse(data));
    } catch (e) {
      console.error("invalid json: " + e);
      err = handlebars.partials.jsonParseError({});
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
  var renderer = new marked.Renderer();
  renderer.table = function(header, body) {
    return '<table class="table">\n'
      + '<thead>\n'
      + header
      + '</thead>\n'
      + '<tbody>\n'
      + body
      + '</tbody>\n'
      + '</table>\n';
  };
  return md ? new handlebars.SafeString(marked(md, { renderer: renderer })) : '';
});
handlebars.registerHelper('upperCase', _.method('toUpperCase'));

var partials = {
  index: 'index.handlebars',
  resource: 'resource.handlebars',
  documentation: 'documentation.handlebars',
  securityScheme: 'security_scheme.handlebars',
  tableOfContents: 'table_of_contents.handlebars',
  style: 'style.css',
  parameters: 'parameters.handlebars',
  jsonParseError: 'invalid_json.handlebars',
};

_.forEach(partials, function(v, k) {
  // handlebars.compile works better and more simply than the
  // handlebars.template function recommended in the docs.
  var template = handlebars.compile(loadTemplate(v));
  handlebars.registerPartial(k, template);
});

var toHtml = handlebars.compile(loadTemplate('index.handlebars'), {
  preventIndent: true
});

module.exports = {
  toHtml: toHtml
};
