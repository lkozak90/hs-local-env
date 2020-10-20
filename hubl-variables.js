'use strict';

const through = require('through');
const chalk = require('chalk');
const gulpMatch = require('gulp-match');
const path = require('path');
const replaceExt = require('replace-ext');
const merge = require('merge');
const hexToRgba = require('hex-to-rgba');

const defaults = {
  targetPre: 'scss',
  delim: '-',
  numberPrefix: '_',
  ignoreJsonErrors: false,
  eol: ';',
  pre: '$',
  propAssign: ': ',
  build: 'scss',
};

let settings;

const invalidCharactersRegex = /(["!#$%&'()*+,.\/:;\s<=>?@\[\]^\{\}|~])/g;

const removeInvalidCharacters = function(str) {
  return str.replace(invalidCharactersRegex, '');
};

const firstCharacterIsNumber = /^[0-9]/;

const buildVariablesRecursive = function(obj, path, themePath, cb) {
  obj.forEach(elem => {
    if (elem.default) {
      // Handle number field, where default value is number
      if (typeof elem.default === 'string' || typeof elem.default === 'number') {
        switch (settings.build) {
          case 'scss':
            // variables for development
            cb(`${settings.pre}${path}${elem.name}${settings.propAssign} ${elem.default}${settings.eol}`);
            break;
          case 'template':
            // variables for production: standard hs templates
            cb(
              typeof elem.default === 'number'
                ? `/*!=={# {% set ${settings.pre}${path}${elem.name} = ${elem.default} %} #}==*/`
                : `/*!=={# {% set ${settings.pre}${path}${elem.name} = "${elem.default}" %} #}==*/`,
            );
            break;
          case 'theme':
            // variables for production: hs theme
            cb(`/*!=={# {% set ${settings.pre}${path}${elem.name} = theme.${themePath}${elem.name} %} #}==*/`);
            break;
        }

        // Handle color field
      } else if (elem.type === 'color' && elem.default.opacity) {
        switch (settings.build) {
          case 'scss':
            // variables for development
            cb(
              `${settings.pre}${path}${elem.name}${settings.propAssign} rgba(${elem.default.color}, ${elem.default
                .opacity / 100})${settings.eol}`,
            );
            break;
          case 'template':
            // variables for production: standard hs templates
            cb(
              `/*!=={# {% set ${settings.pre}${path}${elem.name} = "${hexToRgba(
                elem.default.color,
                elem.default.opacity / 100,
              )}" %} #}==*/`,
            );
            break;
          case 'theme':
            // variables for production: hs theme
            cb(
              `/*!=={# {% set ${settings.pre}${path}${elem.name} = "rgba(" + theme.${themePath}${elem.name}.color|convert_rgb + ", " + theme.${themePath}${elem.name}.opacity/100 + ")" %} #}==*/`,
            );
            break;
        }

        // Handle other fields, where default value is object
      } else {
        for (const prop in elem.default) {
          if (elem.default.hasOwnProperty(prop)) {
            switch (settings.build) {
              case 'scss':
                // variables for development
                cb(
                  `${settings.pre}${path}${elem.name}${settings.delim}${prop}${settings.propAssign} ${elem.default[prop]}${settings.eol}`,
                );
                break;
              case 'template':
                // variables for production: standard hs templates
                cb(
                  typeof elem.default[prop] === 'number'
                    ? `/*!=={# {% set ${settings.pre}${path}${elem.name}${settings.delim}${prop} = ${elem.default[prop]} %} #}==*/`
                    : `/*!=={# {% set ${settings.pre}${path}${elem.name}${settings.delim}${prop} = "${elem.default[prop]}" %} #}==*/`,
                );
                break;
              case 'theme':
                // variables for production: hs theme
                cb(
                  `/*!=={# {% set ${settings.pre}${path}${elem.name}${settings.delim}${prop} = theme.${themePath}${elem.name}.${prop} %} #}==*/`,
                );
                break;
            }
          }
        }
      }
    } else if (elem.children) {
      buildVariablesRecursive(elem.children, elem.name + settings.delim, elem.name + '.', cb);
    }
  });
};

const processJSON = function(file) {
  let parsedJSON;

  // if it does not have a .json suffix, ignore the file
  if (!gulpMatch(file, '**/*.json')) {
    this.push(file);
    return;
  }

  // load the JSON
  try {
    parsedJSON = JSON.parse(file.contents);
  } catch (e) {
    if (settings.ignoreJsonErrors) {
      console.log(chalk.yellow('[gulp-json-css]') + ' Invalid JSON in ' + file.path + '. (Continuing.)');
    } else {
      console.log(chalk.red('[gulp-json-css]') + ' Invalid JSON in ' + file.path);
      this.emit('error', e);
    }
    return;
  }

  // process the JSON
  const variables = [];

  buildVariablesRecursive(parsedJSON, '', '', assignmentString => {
    variables.push(assignmentString);
  });

  const content = variables.join('\n');

  file.contents = Buffer.from(content);

  file.path = replaceExt(file.path, '.' + settings.targetPre);

  this.push(file);
};

module.exports = function(config) {
  settings = merge(defaults, config);

  switch (settings.targetPre) {
    case 'scss':
      settings.pre = '$';
      settings.eol = ';';
      break;
    case 'sass':
      settings.pre = '$';
      settings.eol = '';
      break;
    case 'less':
      settings.pre = '@';
      settings.eol = ';';
      break;
  }

  return through(processJSON);
};
