# Purpose

_raml-fleece_ turns [RAML](http://raml.org) into a readable HTML file. It currently supports version 0.8 as defined in the [0.8 RAML specification](https://github.com/raml-org/raml-spec/blob/master/raml-0.8.md)


# Key Features

- Sidebar containing all resources for easy navigation
- All headers are links
- Links produce readable URL fragments (e.g. `http://example.com/api#GET/users`)
- No collapsed elements make searching easy for browsers

# Installation

    npm install -g janrain/raml-fleece

# Usage

    raml-fleece api.raml > index.html

# Custom Templates and Scripts

Custom Templates and scripts let you overwrite and extend the templates and scripts. See the command line help for details.

# Thanks

This tool was originally built using [raml2html](https://github.com/kevinrenskers/raml2html).
