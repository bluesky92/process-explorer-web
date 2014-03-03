var procView, logCatView,
    // Options
    options = new Options(),
    // ProcessCollection object, collection of all process.
    ps = new ProcessCollection(),
    // Global CPU Info
    globalCpu = new CpuInfo(),
    // Individual CPU info
    cpuInfo = new CpuInfoCollection(),
    // Logcat
    logCatLines = new LogCatLines(),
    // Memory info
    memInfo = new MemInfo(),
    // Concept
    logcat = new LogCat(),
    // CPU % chart
    cpuChart,
    // Mem % chart
    memChart;

var resizeWindow = function () {
    $("#mainLayout")
        .width($(window).width())
        .height($(window).height());
    w2ui["mainLayout"].resize();
};

function uncompress(clist) {
    var ctab = clist.ctab;
    var lstlst = clist.list;
    var r = [];

    _.each(lstlst, function (lst) {
        var obj = {};

        _.each(ctab, function (k) {
            obj[k] = lst.shift();
        });
        r.push(obj);
    });
    return r;
}

var globalProcessUpdate = function () {
    $.ajax("/sysinfo").done(function (sysinfo) {
        var totalDeltaTime;

        console.log("Process list update.");

        globalCpu.set(sysinfo.cpuinfo.global);
        cpuInfo.set(sysinfo.cpuinfo.cpus);
        memInfo.set(sysinfo.meminfo);

        ps.set(uncompress(sysinfo.ps));

        // Update the CPU graph
        cpuInfo.each(function (ci) {
            cpuChart.serie(ci.get("no"), "userPct", ci);
        });

        memChart.serie("memUsed", "memUsed", memInfo);
        memChart.serie("memShared", "memShared", memInfo);

        ps.each(function (proc) {
            proc.updateCpuPct(globalCpu.get("totalDeltaTime") / globalCpu.get("ncpu"));
            proc.updateMemPct(memInfo.get("memTotal"));
        });

        // Calculate the process tree
        ps.each(function (e) {
            if (e.get("pid") != 0 && e.get("ppid") != undefined) {
                var ppsItem = ps.get(e.get("ppid"));
                var ppsItemCh = ppsItem.get("ui-children");

                // Add the new children to the parent.
                ppsItemCh[e.get("pid")] = e;
                ppsItem.set({"ui-children": ppsItemCh});

                // Set the indent and the order of the current process in the
                // tree view.
                e.set({
                    "ui-indent": ppsItem.get("ui-indent") +  1,
                    "ui-parent": ppsItem
                });
            }
        });
    });
};

function setButton(toolbar, btnId, value) {
    _.each(toolbar.items, function (b) {
        if (b.id == btnId) {
            _.each(_.keys(value), function (k) {
                b[k] = value[k];
            });
        }
    });
}

$(document).ready(function () {
    var updateTimer;

    options.fetch();
    options.initOption("pidFilterMode", false);
    options.initOption("rowColorMode", false);
    options.initOption("playing", true);
    options.initOption("delay", 5000);
    options.initOption("maximizeLogcat", false);
    options.initOption("minimizeLogcat", false);

    // Initialize the timer.
    updateTimer = $.timer(globalProcessUpdate, options.getOptionValue("delay"));

    options.getOption("pidFilterMode").on("change", function () {
        if (!options.getOptionValue("pidFilterMode"))
            logCatLines.clearPid();
    });

    options.getOption("rowColorMode").on("change", function () {
        if (options.getOptionValue("rowColorMode"))
            logCatView.applyColors();
        else
            logCatView.clearColors();
    });

    options.getOption("playing").on("change", function () {
        // The process collection updates every 5 seconds.
        if (options.getOptionValue("playing"))
            updateTimer.play();
        else
            updateTimer.pause();
    });

    options.getOption("delay").on("change", function () {
        updateTimer.set({ time: options.getOptionValue("delay") });
    });

    options.getOption("minimizeLogcat").on("change", function () {
        var panel = w2ui["mainLayout"].get("preview");

        if (options.getOptionValue("minimizeLogcat")) {
            setButton(panel.toolbar, "btnFilterByProcess", {hidden: true});
            setButton(panel.toolbar, "btnClear", {hidden: true});
            setButton(panel.toolbar, "btnColors", {hidden: true});
            setButton(panel.toolbar, "btnMinimize", {icon: "icon-chevron-up"});

            w2ui["mainLayout"].set("preview", {size: 0});
        } else {
            setButton(panel.toolbar, "btnFilterByProcess", {hidden: false});
            setButton(panel.toolbar, "btnClear", {hidden: false});
            setButton(panel.toolbar, "btnColors", {hidden: false});
            setButton(panel.toolbar, "btnMinimize", {icon: "icon-chevron-down"});

            w2ui["mainLayout"].set("preview", {size: 200});
        }

        panel.toolbar.refresh();
        logCatView.setElement(w2ui["mainLayout"].el("preview"));
        logCatView.render();
    });

    $("#mainLayout").w2layout({
        name: "mainLayout",
        padding: 4,
        panels: [
            {
                type: "top",
                size: 105,
                content: "<div id='cpuGraph'></div><div id='memGraph'></div>"
            },
            {
                type: "main",
                toolbar: {
                    items: [
                        { type: "check", id: "btnPlay", caption: "Play", icon: "icon-play",
                          checked: options.getOptionValue("playing")
                        },
                        { type: "menu",  id: "mnuDelay", caption: "Delay", img: "icon-time", items: [
                            { text: "1 sec" },
                            { text: "2 sec" },
                            { text: "5 sec" },
                            { text: "10 sec" }
                        ]},
                        { type: ""}
                    ],
                    onClick: function (ev) {
                        if (ev.target == "btnPlay")
                            options.toggleOption("playing");
                    }
                }
            },
            {
                type: "preview",
                size: 200,
                resizer: 5,
                resizable: true,
                class: "logcatview",
                toolbar: {
                    name: "tbPreview",
                    items: [
                        { type: "check",  id: "btnFilterByProcess", caption: "Filter", icon: "icon-long-arrow-down",
                          checked: options.getOptionValue("pidFilterMode")
                        },
                        { type: "button", id: "btnClear",           caption: "Clear",  icon: "icon-remove" },
                        { type: "check",  id: "btnColors",          caption: "Color",  icon: "icon-tint",
                          checked: options.getOptionValue("rowColorMode")
                        },
                        { type: "spacer" },
                        { type: "button", id: "btnMinimize", icon: "icon-chevron-down" }
                    ],
                    onClick: function (ev) {
                        if (ev.target == "btnClear")
                            logCatLines.reset();

                        if (ev.target == "btnFilterByProcess")
                            options.toggleOption("pidFilterMode");

                        if (ev.target == "btnColors")
                            options.toggleOption("rowColorMode");

                        if (ev.target == "btnMaximize")
                            options.toggleOption("maximizeLogcat");

                        if (ev.target == "btnMinimize")
                            options.toggleOption("minimizeLogcat");
                    }
                }
            }
        ],
        onResize: function (ev) {
            // Thanks, w2ui. This thing is elegant but rather confusing...
            ev.onComplete = function () {
                if (procView)
                    procView.autoResize();
                if (logCatView)
                    logCatView.autoResize();
            };
        }
    });

    cpuChart = new ChartView({
        el: $("#cpuGraph"),
        max: 100,
        min: 0,
        delay: 5000,
        width: 300,
        height: 101,
        caption: "CPU"
    });
    memChart = new ChartView({
        el: $("#memGraph"),
        min: 0,
        delay: 5000,
        width: 300,
        height: 101,
        caption: "Memory"
    });
    procView = new ProcessView({
        el: $(w2ui["mainLayout"].el("main")),
        ps: ps
    });
    logCatView = new LogCatView({
        el: $(w2ui["mainLayout"].el("preview")).addClass("logcatview"),
        logcat: logCatLines
    });

    ps.on("remove", function (proc) {
        console.log("Process " + proc.get("name") + "[" + proc.get("pid") + "] removed.");
    });

    procView.on("onProcessSelected", function (el) {
        if (options.getOption("pidFilterMode"))
            logCatLines.setPid(el.get("pid"));
    });

    $(window).resize($.debounce(100, resizeWindow));

    options.activate();

    // Update the process list right now.
    globalProcessUpdate();

    // Reformat the window content.
    resizeWindow();
});