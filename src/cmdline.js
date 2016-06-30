const argv = require('yargs')
  .usage('Usage: $0 [input] [options]')
  .example('$0 myDocs.raml > myDocs.html')
  .example('$0 myDocs.raml -b > myDocs.html')
  .demand(1, 'RAML file required')
  .group([
      'bare',
      'postmanId',
    ],
    'Options:'
  )
  .option('bare', {
    alias: 'b',
    description: 'Omits top level HTML elements and styles if true.',
    default: false
  })
  .option('postmanId', {
    alias: 'p',
    description: 'Add Postman Collection ID',
    default: false
  })
  .group([
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
    ],
    'Custom Templates:'
  )
  .option('template-documentation', {
    description: 'Path to custom documentation template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-index', {
    description: 'path to custom index template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-before-main', {
    description: 'path to custom before main template',
    type: 'string',
    normalize: true
  })
  .option('template-main', {
    description: 'path to custom main template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-after-main', {
    description: 'path to custom after main template',
    type: 'string',
    normalize: true
  })
  .option('template-parameters', {
    description: 'path to custom parameters template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-resource', {
    description: 'path to custom resource template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-securityScheme', {
    description: 'path to custom security scheme template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-tableOfContents', {
    description: 'path to custom table of contents template (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('template-after-tableOfContents', {
    description: 'path to custom after table of contents template',
    type: 'string',
    normalize: true
  })
  .group([
      'before-style',
      'style',
      'after-style',
    ],
    'Custom Styles:'
  )
  .option('style', {
    description: 'Custom style sheet (LESS) (overwrites)',
    type: 'string',
    normalize: true
  })
  .option('before-style', {
    description: 'Custom before style sheet (LESS)',
    type: 'string',
    normalize: true
  })
  .option('after-style', {
    description: 'Custom after style sheet (LESS)',
    type: 'string',
    normalize: true
  })
  .argv;

module.exports.argv = argv
