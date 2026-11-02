// js-yaml optionally requires esprima for YAML !!js/function.
// This extension only safe-parses front matter, and esprima is not installed.
// alwaysBundle would inline the whole parser (~136KB). esbuild left a try/catch require.
module.exports = {};
