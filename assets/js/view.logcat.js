/*
 * Copyright (C) 2014-2015, Opersys inc.
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

var LogCatView = Backbone.View.extend({

    _heuristicTimer: null,
    _hasReadLogHeuristicDone: false,

    _gridColumns: [
        { id: "tag", name: "T", field: "tag", minWidth: 20, maxWidth: 20 },
        { id: "tim", name: "time", field: "tim", midWidth: 60, maxWidth: 90 },
        { id: "pid", name: "PID", field: "pid", minWidth: 50, maxWidth: 50 },
        { id: "msg", name: "Message", field: "msg", minWidth: 300 }
    ],

    _gridOptions: {
        formatterFactory:{
            getFormatter: function (column) {
                return function(row,cell,value,col,data) {
                    return data.get(col.field);
                };
            }
        },

        enableColumnReorder: false,
        enableCellNavigation: true,
        forceFitColumns: true
    },

    clearColors: function () {
        this._grid.removeCellCssStyles("warnings");
        this._grid.removeCellCssStyles("errors");
    },

    applyColors: function () {
        var errorRows = [], warningRows = [];
        var errorCss = {
            "tag": "error", "tim": "error", "pid": "error", "msg": "error"
        };
        var warningCss = {
            "tag": "warning", "tim": "warning", "pid": "warning", "msg": "warning"
        };

        for (var i = 0; i < this._grid.getDataLength(); i++) {
            var row = this._grid.getDataItem(i);
            if (row.get("tag") == "E")
                errorRows[i] = errorCss;
            else if (row.get("tag") == "W")
                warningRows[i] = warningCss;
        }

        this._grid.setCellCssStyles("warnings", warningRows);
        this._grid.setCellCssStyles("errors", errorRows);
    },

    addTagFilter: function (tag) {
        var newfi, fi = this._logcat.getFilterItem("tag");

        if (_.isArray(fi))
            newfi = fi.concat([tag]);
        else
            newfi = [tag];

        this._logcat.setFilterItem("tag", newfi);
    },

    clearTagFilter: function (tag) {
        this._logcat.setFilterItem("tag", _.without(this._logcat.getFilterItem("tag"), tag));
    },

    filterByPid: function (pid) {
        if (this._options.getOptionValue("pidFilterMode")) {
            this._logcat.setFilterItem("pid", pid);

            // FIXME: Cheating on the model.
            $("#txtFiltered").text("Filtered for PID: " + pid);
        }
    },

    clearPidFilter: function () {
        this._logcat.clearFilterItem("pid");

        // FIXME: Cheating on the model
        $("#txtFiltered").text("");
    },

    scrollToEnd: function () {
        this._grid.scrollRowToTop(this._logcat.models[this._logcat.models.length - 1].get("no"));
    },

    autoResize: function () {
        this._grid.resizeCanvas();
        this._grid.autosizeColumns();
    },

    initialize: function (opts) {
        var self = this;

        self._ps = opts.ps;
        self._logcat = opts.logcat;
        self._options = opts.options;

        self._options.getOption("rowColorMode").on("change", function () {
            if (self._options.getOptionValue("rowColorMode"))
                self.applyColors();
            else
                self.clearColors();
        });

        self.render();
    },

    _readLogsTooltip: null,

    /**
     * This is meant as a best-effort heuristic to detect if the application was granted the
     * READ_LOGS permission, which needs to be done manually on Android versions after 4.4.
     */
    readLogsHeuristicCheck: function () {
        var self = this;
        var ss;

        if (!self._readLogsTooltip) {
            var chkId = _.uniqueId("opentip");

            self._readLogsTooltip = new Opentip(this.$el, {
                title: "Not much to see there isn't it?",
                target: this.$el,
                style: "warnPopup",
                targetJoint: "top left",
                tipJoint: "bottom left",
                showOn: null
            });
            self._readLogsTooltip.setContent(
                "<p>Unless Process Explorer has the right to read logs, per-process " +
                " logs will appear blank.</p>" +
                "<p>Give Process Explorer the permission to read the logcat by running the following " +
                "command your computer. You\'ll then need to click on \"Quit the application\" in the " +
                "Process Explorer app on the device and restart the app and the service for the change to " +
                "take effect:</p> " +
                "<pre>$ adb shell pm grant com.opersys.processexplorer android.permission.READ_LOGS</pre>" +
                '<input id="' + chkId + '" type="checkbox" />' +
                '<label for="' + chkId + '">Don\'t show this message again</label>');
        }

        if (self._hasReadLogHeuristicDone)
            return;

        // Get the PID of the system_server process.
        ss = self._ps.findWhere({name: "system_server"});

        // Not finding the system_server would be quite an odd situation but it could happen
        // (I guess). So log it out and presume the user knows what it is doing.
        if (!ss) {
            console.log("Could not find system_server PID");
        } else if (!self._logcat.findWhere({pid: ss.get("pid")})) {
            self._readLogsTooltip.show();

            $(document.getElementById(chkId)).on("click", function () {
                self._hasReadLogHeuristicDone = true;
                self._readLogsTooltip.hide();
            });
        }
    },

    render: function () {
        var self = this;

        this._grid = new Slick.Grid(this.$el, this._logcat, this._gridColumns, this._gridOptions);

        this._logcat.on("add", $.debounce(250,
            function (m) {
                self._grid.scrollRowToTop(m.get("no"));
            }
        ));

        this._logcat.on("append", function () {
            self._grid.updateRowCount();
            self._grid.render();

            if (!self._heuristicTimer && !self._hasReadLogHeuristicDone) {
                self._heuristicTimer = $.timer(
                    function () {
                        self.readLogsHeuristicCheck();
                    },
                    10000);
                self._heuristicTimer.once();
            }

            // Options
            if (self._options.getOptionValue("rowColorMode"))
                self.applyColors();
        });

        this._logcat.on("remove", function () {
            self._grid.updateRowCount();
            self._grid.render();
        });

        this._logcat.on("empty", function () {
            self._grid.updateRowCount();
            self._grid.render();
        });

        // Options
        if (this._options.getOptionValue("rowColorMode"))
            this.applyColors();

        this._grid.setSelectionModel(new Slick.RowSelectionModel());

        this._grid.resizeCanvas();
    }
});