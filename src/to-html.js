'use strict';

var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var hljs = require('highlight.js');
var marked = require('marked');
var handlebars = require('handlebars');
const less = require('less');

var STATUS_CODES = require('../status-codes');
var JSON_INDENT_SIZE = 2;
const noHighlight = ['text/plain'];

function prettyJson(x) {
  return JSON.stringify(x, null, JSON_INDENT_SIZE);
}

function deriveContentType(mimeType) {
  let commonTypes = ['json', 'xml', 'html'].concat(noHighlight);
  return commonTypes.find(x => mimeType.includes(x));
}

// Load file from templates/ directory.
function loadTemplate(x) {
  var f = path.join(__dirname, '..', 'templates', x);
  return fs.readFileSync(f, 'utf-8');
}

function codeBlockMarkup(classString, content) {
  return new handlebars.SafeString(
    `<pre><code${classString}>${content}</code></pre>`
  );
}

function codeBlock(code, lang) {
  if (noHighlight.find(x => x === lang)) return codeBlockMarkup('hljs', code);
  let out = lang ? hljs.highlight(lang, code) : hljs.highlightAuto(code)
  let langClass = ` class="hljs lang-${out.language}"`
  return codeBlockMarkup(langClass, out.value);
}

handlebars.registerHelper('responseCode', function(num) {
  let n = Math.floor(num / 100);
  let message = `${num} ` + handlebars.escapeExpression(STATUS_CODES[num] || '')
  return new handlebars.SafeString(
    `<span class="response-code response-code-${n}xx">${message}</span>`
  );
});
handlebars.registerHelper('nameForSecurityScheme', function(key, options) {
  return key === null ?
    'security optional' :
    key;
});
handlebars.registerHelper('showCodeOrForm', function(data, options) {
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
handlebars.registerHelper('showCode', function(data, options) {
  if (!data) return '';
  let lang = deriveContentType(options.hash.type);
  return codeBlock(data, lang)
});
handlebars.registerHelper('markdown', function(md) {
  var renderer = new marked.Renderer();
  renderer.table = function(header, body) {
    return '<table class="table">'
    + `<thead>${header}</thead>`
    + `<tbody>${body}</tbody>`
    + '</table>'
  };
  renderer.code = codeBlock
  return md ? new handlebars.SafeString(marked(md, { renderer: renderer })) : '';
});
handlebars.registerHelper('upperCase', _.method('toUpperCase'));

var partials = {
  index: 'index.handlebars',
  main: 'main.handlebars',
  resource: 'resource.handlebars',
  documentation: 'documentation.handlebars',
  securityScheme: 'security_scheme.handlebars',
  tableOfContents: 'table_of_contents.handlebars',
  parameters: 'parameters.handlebars',
};

_.forEach(partials, function(v, k) {
  // handlebars.compile works better and more simply than the
  // handlebars.template function recommended in the docs.
  var template = handlebars.compile(loadTemplate(v), { preventIndent: true });
  handlebars.registerPartial(k, template);
});

let lessOptions = {
  compress: true
};
less.render(loadTemplate('style.less'), lessOptions, (error, output) => {
  handlebars.registerPartial('style', output.css)
});

let toHtml = (bare) => {
  return bare ? handlebars.partials.main : handlebars.partials.index
}

module.exports = {
  toHtml: toHtml
};
