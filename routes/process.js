/*
 * Copyright (C) 2014 Opersys inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var _ = require("underscore");
var fs = require("fs");
var util = require("util");

/*
 * get the environment variables for the specified process
 * pid: process id (as int, e.g. 1)
 */
exports.environ = function (req, res) {
    var pid = req.query.pid;

    var path = "/proc/" + pid + "/environ"

    console.log("process::environ(" + pid + ")");

    try {
        var result = { };

        environ = fs.readFileSync(path, { encoding: "utf8" } );
        variables = environ.split("\0");

        for (var i=0; i < variables.length; i++) {
            variable = variables[i].split("=");
            result[variable[0]] = variable[1];
        }

        res.json({ status: "success", pid: pid, variables: result});
    }
    catch (e) {
        console.warn("Exception while reading " + path + " from PID " + pid + ": " + e);
        res.json({ status: "error", pid: pid, error: e.code});
    }
};

/*
 * get the memory maps for the specified process
 * pid: process id (as int, e.g. 1)
 */
exports.maps = function (req, res) {
    var pid = req.query.pid;

    var path = "/proc/" + pid + "/maps"

    console.log("process::maps(" + pid + ")");

    try {
        var result = [ ];

        memory_maps = fs.readFileSync(path, { encoding: "utf8" } );
        maps = memory_maps.split("\n");

        maps.forEach(function(map) {
            m = map.match(/\S+/g);
            if (m != null) {
                var object = {
                    address: m[0],
                    permissions: m[1],
                    offset: m[2],
                    device: m[3],
                    inode: m[4],
                    pathname: m[5],
                };

                result.push(object);
            }
        });

        res.json({ status: "success", pid: pid, maps: result});
    }
    catch (e) {
        console.warn("Exception while reading " + path + " from PID " + pid + ": " + e);
        res.json({ status: "error", pid: pid, error: e.code});
    }
};

exports.files = function (req, res) {
    var pid = req.query.pid;

    console.log("process::files(" + pid + ")");

    var path = "/proc/" + pid + "/fd/"

    try {
        var result = [ ];

        files = fs.readdirSync(path);

        files.forEach(function(file) {
            var object = {
                fd: file,
                path: "",
            };

            switch (file) {
                case "0":
                    object.path = "stdin";
                    break;
                case "1":
                    object.path = "stdout";
                    break;
                case "2":
                    object.path = "stderr";
                    break;
                default:
                    object.path = fs.readlinkSync(path + file);
                    break;
            }

            result.push(object);
        });

        res.json({ status: "success", pid: pid, files: result});
    }
    catch (e) {
        console.warn("Exception while reading " + path + " from PID " + pid + ": " + e);
        res.json({ status: "error", pid: pid, error: e.code});
    }

};
