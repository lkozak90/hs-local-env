// "gulp" for development
// "gulp build" for production file
// "gulp upload" to upload all files from /dist folder to HubSpot

const config = {
  portal: "dev", // from hubspot.config.yml. If you do not have this file, run "hs init". If file is empty or you want to add another portal, run "hs auth" HubSpot CLI need to be preinstalled.
  project: "local-dev-env", // should be same as project folder in HubSpot. All from "dist" folder will be uploaded to HubSpot under "project" name
  projectName: "DEV", // Will be added to the top of production CSS file
  download: "https://www.atfx.com/en/about-us/awards-and-recognitions?hs_preview=BgaMKPbn-33267223557",
  css: "atfx-overrides", // do not need to add extension here. File in downloaded page (index.html) will be searched with regex to find this file and replace it with .css extension.
  js: "lk-dev-scripts",
  puppetter: false, //set it to true to enable download puppetter plugin - it will make CTA display properly, but HTML download time will be longer. Relunch gulp after changing it.
  prodBuild: "template", //set to "theme" to make "gulp prod" generate hubl variables for themes. Default: "template"
  dirs: {
    scss: 'src/scss/',
    modules: 'src/modules/',
  }
}

// export config, so it can be accessable with "require('./config.js)" or with eval() method
module.exports = config;