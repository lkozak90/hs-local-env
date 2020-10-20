// "gulp" for development
// "gulp build" for production file
// "gulp upload" to upload all files from /dist folder to HubSpot

const config = {
  portal: "dev", // from hubspot.config.yml. If you do not have this file, run "hs init". If file is empty or you want to add another portal, run "hs auth" HubSpot CLI need to be preinstalled.
  project: "local-dev-env", // should be same as project folder in HubSpot. All from "dist" folder will be uploaded to HubSpot under "project" name
  projectName: "Local development", // Will be added to the top of production CSS file
  download: "https://preview.hs-sites.com/_hcms/preview/template/multi?domain=undefined&hs_preview_key=ESRNB7bDzRnWjDIN1u0Xfw&portalId=7990709&tc_deviceCategory=undefined&template_file_path=local-dev-env/templates/landing/test.html&updated=1597402424742",
  css: "theme-styles", // do not need to add extension here. File in downloaded page (index.html) will be searched with regex to find this file and replace it with .css extension.
  js: "theme-scripts",
  puppetter: false, //set it to true to enable download puppetter plugin - it will make CTA display properly, but HTML download time will be longer. Relunch gulp after changing it.
  prodBuild: "theme", //set to "theme" to make "gulp prod" generate hubl variables for themes. Default: "template"
  dirs: {
    scss: 'src/scss/',
    modules: 'src/modules/',
  }
}

// export config, so it can be accessable with "require('./config.js)" or with eval() method
module.exports = config;