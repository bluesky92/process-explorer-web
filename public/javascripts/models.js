var Process = Backbone.Model.extend({
    initialize: function () {
        this.set("children", {});
        this.set("indent", 0);
        this.set("pct", 0);
    },
    idAttribute: "pid",
    set: function (n, v) {
        var o = this.attributes;

        if (n == "utime" && o.utime)
            n.deltaUtime = v - o.utime;
        if (n.hasOwnProperty("utime") && o.utime)
            n.deltaUtime = n.utime - o.utime;

        if (n == "stime" && o.stime)
            n.deltaStime = v - o.stime;
        if (n.hasOwnProperty("stime") && o.stime)
            n.deltaStime = n.stime - o.stime;

        if (n.deltaUtime >= 0 && n.deltaStime >= 0)
            n.deltaTime = n.deltaUtime + n.deltaStime;

        Backbone.Model.prototype.set.apply(this, arguments);
    },
    updatePct: function (totalDeltaTime) {
        this.set("pct", this.get("deltaTime") / totalDeltaTime * 100);
    }
});

var SystemCpuInfo = Backbone.Model.extend({
    set: function (n, options) {
        var o = this.attributes;
        n.totalDeltaTime =
            (n.utime + n.ntime + n.stime + n.itime + n.iowtime + n.irqtime + n.sirqtime) -
            (o.utime + o.ntime + o.stime + o.itime + o.iowtime + o.irqtime + o.sirqtime);

        n.userPct = ((n.utime + n.ntime) - (o.utime + o.ntime)) * 100  / n.totalDeltaTime;
        n.sysPct = (n.stime - n.stime) * 100 / n.totalDeltaTime;
        n.iowPct = (n.iowtime - o.iowtime) * 100 / n.totalDeltaTime;
        n.irqPct = ((n.irqtime + n.sirqtime) - (o.irqtime + o.sirqtime)) * 100 / n.totalDeltaTime;

        Backbone.Model.prototype.set.apply(this, arguments);
    }
});

var ProcessCollection = Backbone.Collection.extend({
    model: Process
});