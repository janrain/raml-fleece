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
    'Security Optional' :
    o.data.root.securitySchemes[key].type;
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
      {type: data.type}
    );
  }
  return new handlebars.SafeString(ret);
});
handlebars.registerHelper('showCode', function(data, o) {
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
      err = partials.jsonParseError;
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

var partials = {
  index: 'index.handlebars',
  resource: 'resource.handlebars',
  securityScheme: 'security_scheme.handlebars',
  tableOfContents: 'table_of_contents.handlebars',
  style: 'style.css',
  parameters: 'parameters.handlebars',
  jsonParseError: 'invalid_json.html',
};

_.forEach(partials, function(v, k) {
  handlebars.registerPartial(k, loadTemplate(v));
});

var toHtml = handlebars.compile(loadTemplate('index.handlebars'), {
  preventIndent: true
});

module.exports = {
  toHtml: toHtml
};
