/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @fileOverview Handles notifications.
 */

const {Cu, Ci, Cr, Cc} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");


let {Prefs} = require("./prefs");
let {Downloader, Downloadable, MILLIS_IN_MINUTE, MILLIS_IN_HOUR, MILLIS_IN_DAY} = require("./downloader");
let {Utils} = require("./utils");

let INITIAL_DELAY = 12 * MILLIS_IN_MINUTE;
let CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
let EXPIRATION_INTERVAL = 1 * MILLIS_IN_DAY;

function getNumericalSeverity(notification)
{
  let levels = {information: 0, critical: 1};
  return (notification.severity in levels ? levels[notification.severity] : levels.information);
}

function saveNotificationData()
{
  // HACK: JSON values aren't saved unless they are assigned a different object.
  Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
}

function localize(translations, locale)
{
  if (locale in translations)
    return translations[locale];

  let languagePart = locale.substring(0, locale.indexOf("-"));
  if (languagePart && languagePart in translations)
    return translations[languagePart];

  let defaultLocale = "en-US";
  return translations[defaultLocale];
}

/**
 * The object providing actual downloading functionality.
 * @type Downloader
 */
let downloader = null;

/**
 * Regularly fetches notifications and decides which to show.
 * @class
 */
let Notification = exports.Notification =
{
  /**
   * Called on module startup.
   */
  init: function()
  {


    downloader = new Downloader(this._getDownloadables.bind(this), INITIAL_DELAY, CHECK_INTERVAL);
    onShutdown.add(function()
    {
      downloader.cancel();
    });

    downloader.onExpirationChange = this._onExpirationChange.bind(this);
    downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    downloader.onDownloadError = this._onDownloadError.bind(this);


  },

  /**
   * Yields a Downloadable instances for the notifications download.
   */
  _getDownloadables: function()
  {
    let downloadable = new Downloadable(Prefs.notificationurl);
    if (typeof Prefs.notificationdata.lastError === "number")
      downloadable.lastError = Prefs.notificationdata.lastError;
    if (typeof Prefs.notificationdata.lastCheck === "number")
      downloadable.lastCheck = Prefs.notificationdata.lastCheck;
    if (typeof Prefs.notificationdata.data === "object" && "version" in Prefs.notificationdata.data)
      downloadable.lastVersion = Prefs.notificationdata.data.version;
    if (typeof Prefs.notificationdata.softExpiration === "number")
      downloadable.softExpiration = Prefs.notificationdata.softExpiration;
    if (typeof Prefs.notificationdata.hardExpiration === "number")
      downloadable.hardExpiration = Prefs.notificationdata.hardExpiration;
    yield downloadable;
  },

  _onExpirationChange: function(downloadable)
  {
    Prefs.notificationdata.lastCheck = downloadable.lastCheck;
    Prefs.notificationdata.softExpiration = downloadable.softExpiration;
    Prefs.notificationdata.hardExpiration = downloadable.hardExpiration;
    saveNotificationData();
  },

  _onDownloadSuccess: function(downloadable, responseText, errorCallback, redirectCallback)
  {
    try
    {
      Prefs.notificationdata.data = JSON.parse(responseText);
    }
    catch (e)
    {
      Cu.reportError(e);
      errorCallback("synchronize_invalid_data");
      return;
    }

    Prefs.notificationdata.lastError = 0;
    Prefs.notificationdata.downloadStatus = "synchronize_ok";
    [Prefs.notificationdata.softExpiration, Prefs.notificationdata.hardExpiration] = downloader.processExpirationInterval(EXPIRATION_INTERVAL);
    saveNotificationData();
  },

  _onDownloadError: function(downloadable, downloadURL, error, channelStatus, responseStatus, redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;
    saveNotificationData();
  },

  /**
   * Determines which notification is to be shown next.
   * @param {Array of Object} notifications active notifications
   * @return {Object} notification to be shown, or null if there is none
   */
  getNextToShow: function()
  {
    function checkTarget(target, parameter, name, version)
    {
      let minVersionKey = parameter + "MinVersion";
      let maxVersionKey = parameter + "MaxVersion";
      return !((parameter in target && target[parameter] != name) ||
               (minVersionKey in target && Services.vc.compare(version, target[minVersionKey]) < 0) ||
               (maxVersionKey in target && Services.vc.compare(version, target[maxVersionKey]) > 0));

    }

    if (typeof Prefs.notificationdata.data != "object" || !(Prefs.notificationdata.data.notifications instanceof Array))
      return null;

    if (!(Prefs.notificationdata.shown instanceof Array))
    {
      Prefs.notificationdata.shown = [];
      saveNotificationData();
    }

    let {addonName, addonVersion, application, applicationVersion, platform, platformVersion} = require("info");
    let notifications = Prefs.notificationdata.data.notifications;
    let notificationToShow = null;
    for each (let notification in notifications)
    {
      if ((typeof notification.severity === "undefined" || notification.severity === "information")
          && Prefs.notificationdata.shown.indexOf(notification.id) !== -1)
        continue;

      if (notification.targets instanceof Array)
      {
        let match = false;
        for each (let target in notification.targets)
        {
          if (checkTarget(target, "extension", addonName, addonVersion) &&
              checkTarget(target, "application", application, applicationVersion) &&
              checkTarget(target, "platform", platform, platformVersion))
          {
            match = true;
            break;
          }
        }
        if (!match)
          continue;
      }

      if (!notificationToShow
          || getNumericalSeverity(notification) > getNumericalSeverity(notificationToShow))
        notificationToShow = notification;
    }

    if (notificationToShow && "id" in notificationToShow)
    {
      Prefs.notificationdata.shown.push(notificationToShow.id);
      saveNotificationData();
    }

    return notificationToShow;
  },

  /**
   * Localizes the texts of the supplied notification.
   * @param {Object} notification notification to translate
   * @param {String} locale the target locale (optional, defaults to the
   *                        application locale)
   * @return {Object} the translated texts
   */
  getLocalizedTexts: function(notification, locale)
  {
    locale = locale || Utils.appLocale;
    let textKeys = ["title", "message"];
    let localizedTexts = [];
    for each (let key in textKeys)
    {
      if (key in notification)
        localizedTexts[key] = localize(notification[key], locale);
    }
    return localizedTexts;
  }
};
Notification.init();
