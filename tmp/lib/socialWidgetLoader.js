/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// Loads social media widget replacement info from file

"use strict";

const { data } = require("sdk/self");

exports.loadSocialWidgetsFromFile = loadSocialWidgetsFromFile;

/**
 * Loads a JSON file at filePath and returns the parsed object.
 *
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Object} the JSON at the file at filePath
 */
function loadJSONFromFile(filePath) {
  let jsonString = getFileContents(filePath);
  let jsonParsed = JSON.parse(jsonString);
  Object.freeze(jsonParsed); // prevent modifications to jsonParsed

  return jsonParsed;
}

/**
 * Returns the contents of the file at filePath.
 *
 * @param {String} filePath the path to the file
 *
 * @return {String} the contents of the file
 */
function getFileContents(filePath) {
  return data.load(filePath);
}

/**
 * Returns an array of SocialWidget objects that are loaded from the file at
 * filePath.
 *
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Array} an array of SocialWidget objects that are loaded from the file at
 *                 filePath
 */
function loadSocialWidgetsFromFile(filePath) {
  let socialwidgets = [];
  let socialwidgetsJson = loadJSONFromFile(filePath);

  // loop over each socialwidget, making a SocialWidget object
  for (var socialwidgetName in socialwidgetsJson) {
    let socialwidgetProperties = socialwidgetsJson[socialwidgetName];
    let socialwidgetObject = new SocialWidget(socialwidgetName,
                                  socialwidgetProperties);
    socialwidgets.push(socialwidgetObject);
  }

  return socialwidgets;
}

/**
 * Constructs a SocialWidget with the given name and properties.
 *
 * @param {String} name the name of the socialwidget
 * @param {Object} properties the properties of the socialwidget
 */
function SocialWidget(name, properties) {
  this.name = name;

  for (var property in properties) {
    this[property] = properties[property];
  }
}

