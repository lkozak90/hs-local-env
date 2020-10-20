/* eslint-disable */

const gulp = require('gulp'),
  { series, src, dest, watch, parallel } = require('gulp'),
  path = require('path'),
  fs = require('fs'),
  del = require('del'),
  plugins = require('gulp-load-plugins')({ camelize: true }),
  autoprefixer = require('autoprefixer'),
  through = require('through2'),
  exec = require('child_process').exec,
  replace = require('gulp-replace'),
  rename = require('gulp-rename'),
  header = require('gulp-header'),
  footer = require('gulp-footer'),
  sourcemaps = require('gulp-sourcemaps'),
  sass = require('gulp-sass'),
  sassGlob = require('gulp-sass-glob'),
  sassGlobImport = require('gulp-sass-glob-import'),
  importResolve = require('import-resolve'),
  postcss = require('gulp-postcss'),
  stripCssComments = require('gulp-strip-css-comments'),
  babel = require('gulp-babel'),
  concat = require('gulp-concat'),
  plumber = require('gulp-plumber'),
  notify = require('gulp-notify'),
  uglify = require('gulp-uglify'),
  browserSync = require('browser-sync'),
  scrape = require('website-scraper'),
  PuppeteerPlugin = require('website-scraper-puppeteer'),
  SaveToExistingDirectoryPlugin = require('website-scraper-existing-directory'),
  hublVariables = require('./hubl-variables.js');

const paths = {
  styles: {
    srcDir: 'src/scss',
    src: 'src/scss/**/*.scss',
    main: 'src/scss/main.scss',
    devDest: 'dev/css',
    prodDest: 'dist/css',
  },
  scripts: {
    src: [
      'src/js/polyfills/**/*.js',
      'src/js/vendors/**/*.js',
      'src/js/globals/**/*.js',
      'src/js/layout/**/*.js',
      'src/js/modules/**/*.js',
    ],
    devDest: 'dev/js',
    prodDest: 'dist/js',
  },
  modules: {
    src: 'src/modules/**/*',
    dest: 'dist/modules',
  },
  macros: {
    src: 'src/macros/**/*',
    dest: 'dist/macros',
  },
  templates: {
    src: 'src/templates/**/*',
    dest: 'dist/templates',
  },
  icons: {
    src: 'src/icons/*.svg',
    dest: 'dist/icons',
  },
  download: {
    directory: 'dev/',
  },
  variables: {
    src: 'src/fields.json',
    dest: 'dist/',
  },
  theme: {
    src: 'src/theme.json',
    dest: 'dist/',
  },
};

/*
  Local development: SCSS, JS, download, browsersync
*/

// Build config variable locally. Changes in config.js will dynamically apply to gulp
let configJs = {};
async function readConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(
      './gulpconfig.js',
      'utf8',
      // Read file callback§
      function (err, data) {
        if (err && err.errno === -2) {
          createConfig(resolve);
        } else {
          // eval() will change string to js object
          configJs = eval(data);
          resolve();
        }
      },
    );
  });
}

function createConfig(resolve) {
  return fs.readFile(
    './gulpconfig.sample.js',
    'utf8',
    // Read file callback§
    function (err, data) {
      // eval() will change string to js object
      configJs = eval(data);

      fs.writeFile('./gulpconfig.js', data, function () {
        resolve();
      });
    },
  );
}

// Initialize browserSync server
const server = browserSync.create();

// Set clean task
const cleanDev = () => del([paths.download.directory]);
const cleanDist = () => del(['dist/']);
const cleanDevAssets = () => del([`${paths.download.directory}*`, `!${paths.download.directory}index.html`]);
const cleanHublTemp = () => del([`${paths.styles.srcDir}/mainGlob.scss`]);

class ReplaceSources {
  apply(registerAction) {
    registerAction('onResourceSaved', async ({ resource }) => {
      const filename = resource.getFilename();
      if (filename === 'index.html') {
        let output = resource.getText();
        if (!configJs.css.endsWith('.css')) {
          const searchRegex = new RegExp(`${configJs.css}.*\.css`, 'g');
          const replaceWith = `${configJs.css}.css`;
          if (searchRegex.test(output)) {
            output = output.replace(searchRegex, replaceWith);
          } else {
            output = output.replace("</head>", `<link rel="stylesheet" href="css/${replaceWith}"></head>`)
          }
        }

        if (!configJs.js.endsWith('.js')) {
          const searchRegex = new RegExp(`${configJs.js}.*\.js`, 'g');
          const replaceWith = `${configJs.js}.js`;
          output = output.replace(searchRegex, replaceWith);
        }

        fs.writeFileSync(`${paths.download.directory}index.html`, output);
      }
    });
  }
}

// Set download task
async function download(done) {
  // Set download options
  // If want to properly render CTA and other dynamically loading elements, set "puppetter" to true in config.js
  const downloadOptions = {
    urls: [
      {
        url: configJs.download,
        filename: 'index.html',
      },
    ],
    directory: paths.download.directory,
    request: {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36',
      },
    },
    plugins: configJs.puppetter
      ? [new SaveToExistingDirectoryPlugin(), new PuppeteerPlugin(), new ReplaceSources()]
      : [new SaveToExistingDirectoryPlugin(), new ReplaceSources()],
  };

  const result = await scrape(downloadOptions);
  done();
}

// Handle serve
function serve(done) {
  server.init({
    server: {
      baseDir: paths.download.directory,
    },
    ghostMode: false,
    timestamps: false,
    open: false,
  });
  done();
}

// Handle server reload
function reload(done) {
  server.reload();
  done();
}

// Generate scss variables from fields.json file, using hublVariables() - plugin code in hubl-variables.js
// Variables will be saved to app/scss/generated/scssVariables.scss and used in scssTask
function generateScssVariablesTask() {
  return src([paths.variables.src])
    .pipe(hublVariables())
    .pipe(concat('scssVariables.scss'))
    .pipe(
      header(
        `/* ===============  VARIABLES  =============== */\n\n// THIS FILE IS AUTOGENERATED FROM ${paths.variables.src} \n\n`,
      ),
    )
    .pipe(dest(`${paths.styles.srcDir}/generated`));
}

// Scss to css task connected with browserSync
function scssTask() {
  return src([paths.styles.main], { sourcemaps: true })
    .pipe(
      plumber({
        errorHandler: notify.onError({
          message: '<%= error.message %>',
          title: 'SCSS Error',
          icon: 'sass.png',
        }),
      }),
    )
    .pipe(concat(configJs.css))
    .pipe(sassGlob())
    .pipe(header(fs.readFileSync(`${paths.styles.srcDir}/generated/scssVariables.scss`, 'utf8')))
    .pipe(sass.sync()) // First scss compilation to resolve special scss functions like "hubl_rgba"
    .on('error', sass.logError)
    .pipe(replace(`"{# rgba({{`, 'rgba(')) // replace hubl_rgba function with scss rgba
    .pipe(replace(`|convert_rgb }}`, ''))
    .pipe(replace(` #}"`, ''))
    .pipe(sass.sync())
    .on('error', sass.logError)
    .pipe(postcss([autoprefixer()]))
    .pipe(
      rename(function (path) {
        path.extname = '.css';
      }),
    )
    .pipe(sourcemaps.write('.'))
    .pipe(dest(paths.styles.devDest))
    .pipe(server.stream());
}

// Compile js task
function jsTask() {
  return src(paths.scripts.src, { sourcemaps: true })
    .pipe(
      plumber({
        errorHandler: notify.onError({
          message: '<%= error.message %>',
          title: 'JS Error',
          icon: 'js.png',
        }),
      }),
    )
    .pipe(sourcemaps.init())
    .pipe(babel({ retainLines: true }))
    .pipe(concat(configJs.js))
    .pipe(
      rename(function (path) {
        path.extname = '.js';
      }),
    )
    .pipe(sourcemaps.write('.'))
    .pipe(dest(paths.scripts.devDest));
}

function jsProdTask() {
  return (
    src(paths.scripts.src)
      .pipe(babel({ retainLines: true }))
      // .pipe(header('\n// file: <%= file.relative %>\n'))
      // .pipe(footer('\n// end file: <%= file.relative %>\n'))
      .pipe(uglify())
      .pipe(concat(configJs.js))
      .pipe(
        rename(function (path) {
          path.extname = '.min.js';
        }),
      )
      .pipe(dest(paths.scripts.prodDest))
  );
}

// Production tasks - generating hubl variables for standard HubSpot template / themes

// Create scss file with variables from fields.json
// Variables are commented out to prevent them to be compiled witch sass() plugin in further tasks
function generateHublVariablesTask() {
  return src([paths.variables.src])
    .pipe(hublVariables({ build: configJs.prodBuild }))
    .pipe(concat('hsVariables.scss'))
    .pipe(
      header(
        `/* ===============  VARIABLES  =============== */\n\n// THIS FILE IS AUTOGENERATED FROM ${paths.variables.src} \n\n`,
      ),
    )
    .pipe(dest(`${paths.styles.srcDir}/generated`));
}

// Prepare temporary main scss import file (mainGlob.scss) to process it in scssToHublTask
function mergeScssTask() {
  return src([`${paths.styles.srcDir}/generated/hsVariables.scss`, paths.styles.main])
    .pipe(sassGlob())
    .pipe(sassGlobImport())
    .pipe(concat('mainGlob.scss'))
    .pipe(dest(`${paths.styles.srcDir}`));
}

// Use importResolve plugin to resolve all scss imports from mainGlob.scss and change output file: convert scss variables to hubl variables
async function scssToHublTask() {
  // Return Promise for gulp
  return new Promise((resolve, reject) => {
    importResolve(
      {
        ext: 'scss',
        pathToMain: `${paths.styles.srcDir}/mainGlob.scss`,
      },
      // Callback, where output will be modified
      function (output) {
        // Read file with variables
        const hsVariables = fs.readFile(
          `${paths.styles.srcDir}/generated/hsVariables.scss`,
          'utf8',
          // Read file callback
          function (err, file) {
            // Create array from hsVariables.scss file lines
            const fileContent = file.split('\n');
            // Prepare regex syntax
            const regexStart = /(\/\*!=={#\s{%\sset\s)/g;
            const regexEnd = /(\s=).*/g;

            // Filter hsVariables.scss content to return only lines with variables
            const foundVariables = fileContent.filter(line => line.match(regexStart));

            // Create new array with variables in scss format
            const hsVariablesArray = foundVariables.map(item => item.replace(regexStart, '').replace(regexEnd, ''));

            // Copy output to make changes inside it
            let newOut = output;

            // Loop through hsVariablesArray and replace in outup all occurances of matching scss variables with commented Hubl variables
            // HubL variables are commented, so sass compilator will not throw error in hublScssCompileTask task
            hsVariablesArray.forEach(variable => {
              // Search for variables in output, but not look for statements started with "set" or "#{"
              const searchRegExp = new RegExp(`\w*(?<!set |#{|{# {{ )\\${variable}`, 'g');
              const replaceWith = `"{# {{ ${variable} }} #}"`;

              // Search for scss statements like #{$variable}
              const searchHashScssStart = new RegExp(`#{\\${variable}`, 'g');
              const searchHashScssEnd = new RegExp(`(?<=(#{\\${variable}))[^\}]*(\})?`, 'g');

              // First two replaces are about number variables used like that #{$variable - 4}. It will be converted to "{# {{ $variable - 4 }} #}"
              newOut = newOut.replace(searchHashScssEnd, match => {
                let replaceWith = match.replace('}', '');
                replaceWith += ` }} #}"`;
                return replaceWith;
              });
              newOut = newOut.replace(searchHashScssStart, `"{# {{ ${variable}`);

              // Third replace will handle standard variables: "$variable -> {# {{ $variable }} #}"
              newOut = newOut.replace(searchRegExp, replaceWith);
            });

            // Write file with scss variables converted to Hubl variables
            fs.writeFileSync(`${paths.styles.srcDir}/generated/mainCombined.scss`, newOut);
            // Resolve Promise
            resolve();
          },
        );
      },
    );
  });
}

// Compile production css file
function hublScssCompileTask() {
  const versionDate = new Date().toLocaleString();
  return (
    src([`${paths.styles.srcDir}/generated/mainCombined.scss`])
      .pipe(concat(configJs.css))
      .pipe(stripCssComments())
      .pipe(sassGlob())
      .pipe(
        sass.sync({
          outputStyle: 'compact',
        }),
      )
      .on('error', sass.logError)
      .pipe(postcss([autoprefixer()]))
      // After scss is compiled, uncomment HubL variables
      .pipe(replace('/*!=={# ', '')) // Uncomment variables declarations at start: {% set = $variable %}
      .pipe(replace(' #}==*/', ''))
      .pipe(replace('"{# ', '')) // Uncomment variables calls in whole css: {{ $variable }}
      .pipe(replace(' #}"', ''))
      .pipe(replace('{# {{ ', '')) // Uncomment variables from hubl_rgba scss function (functions.scss): rgba({{ $variable|convert_rgb }}, 0.3)
      .pipe(replace(' }} #}', ''))
      .pipe(
        // Build hubl rem from numbers or hubl variables. Strings like "22/{{ $globalFontSize }}rem" will be converted to "{{ 22/$globalFontSize }}rem"
        replace(/[0-9]+\/{1}{{ |{{.*}}\/{1}{{ /g, match => {
          let value = match
            .replace('/{{ ', '')
            .replace('{{ ', '')
            .replace(' }}', '');
          return `{{ ${value}/`;
        }),
      )
      .pipe(
        // Build hubl rem from numbers or hubl variables. Strings like "{{ $globalFontSize }}/22rem" will be converted to "{{ $globalFontSize/22 }}rem"
        replace(/ }}\/[0-9]+rem/g, match => {
          let value = match.replace(' }}', '').replace('rem', ' }}');
          return `${value}rem`;
        }),
      )
      .pipe(
        rename(function (path) {
          path.extname = '.css';
        }),
      )
      .pipe(
        header(
          `/* ============================\n  ${configJs.projectName} \n  build: ${versionDate} \n============================ */\n\n`,
        ),
      )
      .pipe(dest(paths.styles.prodDest))
  );
}

function themeFieldsTask() {
  return src([paths.theme.src, paths.variables.src]).pipe(dest(paths.theme.dest));
}

/*
  HubSpot: build modules, fetch data, upload
*/
// Build all modules at start
function buildModules() {
  return src([
    'src/modules/**/*',
    '!src/modules/**/fields.local.json',
    '!src/modules/**/fields.global.json',
    '!src/modules/**/meta.global.json',
    '!src/modules/**/meta.local.json',
    '!src/modules/**/fields/*', //exclude
  ]).pipe(dest(paths.modules.dest));
}

// Build only changed module on watch
function buildModule(file) {
  console.log('Sending module to portal');
  const moduleFolder = file.replace('src/modules/', '').split('/')[0];
  return src([
    `src/modules/${moduleFolder}/*`,
    `!src/modules/${moduleFolder}/fields.local.json`,
    `!src/modules/${moduleFolder}/fields.global.json`,
    `!src/modules/${moduleFolder}/meta.global.json`,
    `!src/modules/${moduleFolder}/meta.local.json`,
    `!src/modules/${moduleFolder}/fields/*`, //exclude
  ]).pipe(dest(`${paths.modules.dest}/${moduleFolder}`));
}

async function buildModuleFields(file) {
  return new Promise((resolve, reject) => {
    // Skip if file doesn't exist...
    if (!fs.existsSync(file)) reject();
    console.log(`Building fields for ${file}`);
    let fieldsFile = path.join(__dirname, file);
    // Config file that lists all .json files
    const fields = require(fieldsFile);
    const filePath = file.replace('/fields/fields.js', '');
    delete require.cache[require.resolve(fieldsFile)];
    console.log(fields.config());
    // Merge all .json files into fields.local.json
    src(fields.config())
      .pipe(plugins.concat('fields.local.json', { newLine: ',\n' }))
      .pipe(plugins.header('['))
      .pipe(plugins.footer(']'))
      .pipe(dest(filePath));

    resolve();
  });
}

// Build all macros on start
function buildMacros() {
  return src(paths.macros.src).pipe(dest(paths.macros.dest));
}

// Build only changed macro on watch
function buildMacro(file) {
  console.log('Sending macro to portal');
  return src(file).pipe(dest(paths.macros.dest));
}

// Build all macros on start
function buildTemplates() {
  return src(paths.templates.src).pipe(dest(paths.templates.dest));
}

// Build only changed macro on watch
function buildTemplate(file) {
  console.log('Sending template to portal');
  const templateFolder = file.replace('src/templates/', '').split('/')[0];
  return src(file).pipe(dest(`${paths.templates.dest}/${templateFolder}/`));
}

function buildModule(file) {
  console.log('Sending module to portal');
  const moduleFolder = file.replace('src/modules/', '').split('/')[0];
  return src([
    `src/modules/${moduleFolder}/*`,
    `!src/modules/${moduleFolder}/fields.local.json`,
    `!src/modules/${moduleFolder}/fields.global.json`,
    `!src/modules/${moduleFolder}/meta.global.json`,
    `!src/modules/${moduleFolder}/meta.local.json`,
    `!src/modules/${moduleFolder}/fields/*`, //exclude
  ]).pipe(dest(`${paths.modules.dest}/${moduleFolder}`));
}

const fetchMeta = async file => {
  return new Promise((resolve, reject) => {
    console.log('Fetching meta.json from portal');
    src(file).pipe(
      through.obj((file, enc, cb) => {
        const dir = /modules\/(.+\.module)/gm.exec(file.path)[1];
        const localPath = file.path.replace('local.json', 'global.json');

        exec(
          `yarn hs fetch --portal=${configJs.portal} ${configJs.project}/modules/${dir}/meta.json ${localPath} --overwrite`,
          (err, stdout, stderr) => {
            console.log(stdout);
            resolve();
            cb(err);
          },
        );
      }),
    );
  });
};

const mergeMeta = file => {
  return new Promise((resolve, reject) => {
    src(file).pipe(
      through.obj((file, enc, cb) => {
        const localFile = file.path.replace('.global.json', '.local.json');
        const rootFile = file.path.replace('.global.json', '.json');
        console.log(`Merging ${localFile} with ${file.path} in ${rootFile}`);
        try {
          const rootJson = JSON.parse(fs.readFileSync(file.path).toString('utf8'));
          const localJson = JSON.parse(fs.readFileSync(localFile).toString('utf8'));
          console.log(rootJson.module_id);
          // retrieve module_id from portal and set in global file
          localJson.module_id = rootJson.module_id;

          if (rootJson.status !== 'error') {
            fs.writeFileSync(rootFile, JSON.stringify(localJson, null, 2));
            console.log('Succesfully merged meta.json');
            resolve();
          } else {
            fs.writeFileSync(rootFile, fs.readFileSync(localFile).toString('utf8'));
            resolve();
          }
        } catch (error) {
          console.log('Module is not yet defined.');
          fs.writeFileSync(rootFile, fs.readFileSync(localFile).toString('utf8'));
          reject();
        }
        cb();
      }),
    );
  });
};

const fetchFields = file => {
  console.log('Fetching fields.json from portal');
  return new Promise((resolve, reject) => {
    src(file).pipe(
      through.obj((file, enc, cb) => {
        const dir = /modules\/(.+\.module)/gm.exec(file.path)[1];

        exec(
          `yarn hs fetch --portal=${configJs.portal} ${configJs.project}/modules/${dir}/fields.json ${file.path} --overwrite`,
          (err, stdout, stderr) => {
            console.log(stdout);
            resolve();

            cb(err);
          },
        );
      }),
    );
  });
};

const mergeFields = async file => {
  return new Promise(async (resolve, reject) => {
    console.log('Starting to merge fields');
    const localFile = file.replace('.global.json', '.local.json');
    const rootFile = file.replace('.global.json', '.json');

    try {
      const globalJson = JSON.parse(fs.readFileSync(file).toString('utf8'));
      const localJson = JSON.parse(fs.readFileSync(localFile).toString('utf8'));

      // Loop through global JSON and set ID and default in local file
      if (globalJson.length > 0) {
        for (i = 0; i < globalJson.length; i++) {
          const localIndex = await localJson.findIndex(localField => localField.name === globalJson[i].name);

          if (localIndex !== -1) {
            localJson[localIndex].id = globalJson[i].id;
            localJson[localIndex].default = globalJson[i].default;
          }

          if (i === globalJson.length - 1) {
            if (globalJson.status !== 'error' && localJson.status !== 'error') {
              fs.writeFileSync(rootFile, JSON.stringify(localJson, null, 2));
              console.log('Succesfully merged fields.json');
              resolve();
            } else {
              fs.writeFileSync(rootFile, fs.readFileSync(localFile).toString('utf8'));
              resolve();
            }
          }
        }
      } else {
        console.log('Module does not exist in portal yet. Syncing local content');
        fs.writeFileSync(rootFile, fs.readFileSync(localFile).toString('utf8'));
        resolve();
      }
    } catch (error) {
      console.log(error);
      console.log('Module is not yet defined.');
      fs.writeFileSync(rootFile, fs.readFileSync(localFile).toString('utf8'));
      reject();
    }
  });
};

const uploadFile = file => {
  return new Promise((resolve, reject) => {
    src(file).pipe(
      through.obj((file, enc, cb) => {
        const filePath = path.relative(file.cwd, file.path);
        exec(
          `hs upload --portal=${configJs.portal} ${filePath} ${configJs.project}/${filePath.replace(/dist\/?/, '')}`,
          (err, stdout, stderr) => {
            console.log(stdout);
            cb(err);
          },
        );
        resolve();
      }),
    );
  });
};

const removeFile = file => {
  return new Promise((resolve, reject) => {
    exec(
      `hs remove --portal=${configJs.portal} ${configJs.project}/${file.replace(/dist\/?/, '')}`,
      (err, stdout, stderr) => {
        console.log(stdout);
      },
    );
    resolve();
  });
};

const removeSrc = file => {
  return new Promise((resolve, reject) => {
    del([`${file.replace('src/', 'dist/')}`]);
    resolve();
  });
};

async function uploadAllFiles() {
  uploadFile('dist/');
}

const Build = series(
  // Clean dist folder
  cleanDist,
  // Read config and prepare to build
  readConfig,
  generateHublVariablesTask,
  mergeScssTask,
  scssToHublTask,
  // Build
  parallel(hublScssCompileTask, jsProdTask, themeFieldsTask),
  buildMacros,
  buildModules,
  buildTemplates,
);

const Upload = series(readConfig, uploadAllFiles);

const Watch = function () {
  // Local development

  // Watch for SCSS and JS changes
  watch([paths.styles.src], scssTask);
  watch(paths.scripts.src, series(jsTask, reload));

  // Watch for changes in fields.json and compile SCSS again
  watch([paths.variables.src], series(readConfig, generateScssVariablesTask, scssTask));

  // Watch for changes in config file. Update local server
  watch(
    ['gulpconfig.js'],
    series(readConfig, cleanDevAssets, download, generateScssVariablesTask, parallel(scssTask, jsTask)),
  );

  // Reload server when dev/index.html is changed - it will trigger after gulpconfig.js change (download)
  watch([`${paths.download.directory}index.html`], reload);

  // watch(['src/icons/*.svg'], BuildIcons);

  // Building modules
  // Module will be compiled and added to HubSpot only when .html, fields/fields.js or meta.local.json will be saved
  watch(['src/modules/**/*.html', '!src/modules/**/fields.json', '!src/modules/**/fields/fields.js']).on(
    'change',
    file => buildModule(file),
  );

  watch(['src/modules/**/fields/fields.js']).on('change', async file => {
    const globalFile = file.replace('/fields/fields.js', '/fields.global.json');
    await fetchFields(globalFile);
    await buildModuleFields(file);
    await mergeFields(globalFile);
    buildModule(file);
  });

  watch(['src/modules/**/meta.local.json']).on('change', async file => {
    const globalFile = file.replace('local.json', 'global.json');
    await fetchMeta(file);
    await mergeMeta(globalFile);
    buildModule(file);
  });

  // Build macro in /dist folder when:
  // 1. new .html file is added in /src/macros/
  watch(['src/macros/**/*.html']).on('add', file => buildMacro(file));
  // 2. .html file is changed in src/macros/
  watch(['src/macros/**/*.html']).on('change', file => buildMacro(file));

  // Remove macro from /dist when .html in /src/macros has been delated
  watch(['src/macros/**/*.html']).on('unlink', file => removeSrc(file));

  // Same as in macro
  watch(['src/templates/**/*.html']).on('add', file => buildTemplate(file));
  watch(['src/templates/**/*.html']).on('change', file => buildTemplate(file));
  watch(['src/templates/**/*.html']).on('unlink', file => removeSrc(file));

  // Remove folder from /dist when it is delated in /src
  watch(['src/**']).on('unlinkDir', file => removeSrc(file));

  // Upload file to HubSpot when new file has been added /dist
  watch(['dist/**/*']).on('add', async file => {
    await uploadFile(file);
  });

  // Upload file to HubSpot when file has been changed in /dist
  watch(['dist/**/*']).on('change', async file => {
    await uploadFile(file);
    setTimeout(async function () {
      await download(server.reload);
    }, 2000);
  });

  // Remove file from HubSpot when file has been delated from /dist
  watch(['dist/**/*']).on('unlink', async file => {
    await removeFile(file);
    setTimeout(async function () {
      await download(server.reload);
    }, 2000);
  });

  // Remove folder from HubSpot when folder has been delated from /dist
  watch(['dist/**/*']).on('unlinkDir', async file => {
    await removeFile(file);
    setTimeout(async function () {
      await download(server.reload);
    }, 2000);
  });
};

exports.build = Build;
exports.upload = Upload;

exports.default = series(
  readConfig,
  cleanDevAssets,
  download,
  generateScssVariablesTask,
  parallel(scssTask, jsTask),
  serve,
  Watch,
);
