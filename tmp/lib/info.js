// Useful information about the application and runtime environment,

const { Cu } = require("chrome");
const self = require("sdk/self");

Cu.import("resource://gre/modules/Services.jsm", null);

let applications = {"{a23983c0-fd0e-11dc-95ff-0800200c9a66}": "fennec", "toolkit@mozilla.org": "toolkit", "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}": "firefox", "dlm@emusic.com": "emusic", "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}": "seamonkey", "{aa3c5121-dab2-40e2-81ca-7ea25febc110}": "fennec2", "{a79fe89b-6662-4ff4-8e88-09950ad4dfde}": "conkeror", "{aa5ca914-c309-495d-91cf-3141bbb04115}": "midbrowser", "songbird@songbirdnest.com": "songbird", "prism@developer.mozilla.org": "prism", "{3550f703-e582-4d05-9a08-453d09bdfdc6}": "thunderbird"};

let appInfo = Services.appinfo;

exports = {
  addonID: self.id,
  addonVersion: self.version,
  addonRoot: self.data.url(""),
  addonName: self.name,
  application: (appInfo.ID in applications ? applications[appInfo.ID] : "other"),
  applicationVersion: appInfo.version,
  platform: "gecko",
  platformVersion: appInfo.platformVersion
};
