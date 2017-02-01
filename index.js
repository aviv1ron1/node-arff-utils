"use strict";

var _ = require("underscore");
var util = require('util');
var fs = require('fs');
var Csvly = require('csvly');
var Readable = require('stream').Readable;
const EventEmitter = require('events').EventEmitter;

const ATTRIBUTE = "@ATTRIBUTE";
const DATA = "@DATA";
const EOL = require("os").EOL;

var len = function(obj) {
    return Object.keys(obj).length;
}

var dataTypes = {
    INT: "integer",
    REAL: "real",
    NUMERIC: "numeric",
    STRING: "string",
    DATE: "date",
    NOMINAL: "nominal"
}

function arrayToStream(arr, opts) {
    Readable.call(this, {
        objectMode: true
    });
    if (opts && opts.delim) {
        this.delim = opts.delim;
    }
    this.arr = arr;
    this.idx = 0;
}

util.inherits(arrayToStream, Readable);

arrayToStream.prototype._read = function() {
    if (this.idx < this.arr.length) {
        var str = this.arr[this.idx++];
        if (this.delim) {
            str += this.delim;
        }
        this.push(str);
    } else {
        this.push(null);
    }
};

var isDefined = function(obj) {
    return !util.isNullOrUndefined(obj);
}

var MODES = {
    CSV: 0,
    ARRAY: 1,
    OBJECT: 2
}

function writer(sw) {
    this.write = function() {
        var w = function(val, space) {
            if (!util.isNullOrUndefined(val)) {
                sw.write(val);
                if (space) {
                    sw.write(" ");
                }
            }
        }
        for (var i = 0; i < arguments.length - 1; i++) {
            w(arguments[i], true);
        }
        w(arguments[arguments.length - 1]);
    }
    this.writeLine = function() {
        arguments[arguments.length] = EOL;
        arguments.length++;
        this.write.apply(this, arguments);
    }
}

function arff(relation, mode, options) {
    this.relation = relation;
    this.attributesMap = {};
    this.attributesArr = [];
    this.data = [];
    this.headerMode = true;
    this.mode = MODES.ARRAY;

    // var mode;
    // var options;
    if (isDefined(arguments[1])) {
        if (typeof arguments[1] == "string") {
            mode = arguments[1];
            if (isDefined(arguments[2])) {
                options = arguments[2];
            }
        } else {
            options = arguments[1];
            mode = undefined;
        }
    }

    if (isDefined(mode)) {
        if (isDefined(MODES[mode])) {
            this.mode = MODES[mode];
        } else {
            throw new Error("illegal mode value");
        }
    }
    this.setMode(this.mode);
    this.handler;
    this.writer;
    var self = this;
    this.attributeHandlers = {
        "nominal": self.addNominalAttribute,
        "string": self.addStringAttribute,
        "numeric": self.addNumericAttribute,
        "real": self.addNumericAttribute,
        "integer": self.addNumericAttribute,
        "date": self.addDateAttribute
    }
    if (isDefined(options)) {
        if (isDefined(options.reduce)) {
            this.reduce = options.reduce;
        }
        if (isDefined(options.skipRedundantNominal)) {
            this.skipRedundantNominal = options.skipRedundantNominal;
        }
    }
    EventEmitter.call(this);
}

util.inherits(arff, EventEmitter);

arff.prototype.setMode = function(mode) {
    var self = this;
    var handle = function(d, getLength, getArr, getValue) {
        if (getLength(d) != self.attributesArr.length) {
            //throw new Error("incompatible data size unequal to the number of attributes");
            self.emit('error', { message: "incompatible data size unequal to the number of attributes", data: d });
            return;
        }
        self.writer.writeLine.apply(self.writer, _.map(getArr(d), function(val, index) {
            if (isDefined(self.attributesArr[index])) {
                var ch = ",";
                if (index == self.lastIndex) {
                    ch = "";
                }
                var value = getValue(d, val, index);
                if (isDefined(self.reduce) && isDefined(self.reduce[value])) {
                    value = self.reduce[value];
                }
                switch (self.attributesArr[index].data.type) {
                    case dataTypes.DATE:
                        return escape(value, '"', /./) + ch;
                    default:
                        return escape(value) + ch;
                }
            }
        }));
    }
    var handleArray = function(d) {
        handle(d, function(d) {
                return d.length
            }, function(d) {
                return d
            },
            function(d, val, index) {
                return val;
            })
    }
    var handleObject = function(d) {
        handle(d, function(d) {
            return len(d)
        }, function(d) {
            return _.keys(d)
        }, function(d, val, index) {
            return d[val]
        })
    }
    switch (mode) {
        case MODES.CSV:
            this.handler = handleArray;
            break;
        case MODES.OBJECT:
            this.handler = handleObject;
            break;
        case MODES.ARRAY:
            this.handler = handleArray;
            break;
    }
};



arff.prototype.addAttribute = function(attribute, type, meta) {
    this.attributeHandlers[type.toLowerCase()].apply(this, [attribute, meta]);
}

arff.prototype.addNumericAttribute = function(name) {
    this._addAttribute(name, {
        type: dataTypes.NUMERIC
    });
};

arff.prototype.addStringAttribute = function(name) {
    this._addAttribute(name, {
        type: dataTypes.STRING
    });
};

arff.prototype.addDateAttribute = function(name, format) {
    this._addAttribute(name, {
        type: dataTypes.DATE,
        format: format
    });
};

arff.prototype.addNominalAttribute = function(name, values) {
    if (util.isNullOrUndefined(values)) {
        values = [];
    }
    var self = this;
    if (this.reduce) {
        values = _.map(values, function(val, index) {
            if (isDefined(self.reduce[val])) {
                return self.reduce[val];
            } else {
                return val;
            }
        });
    }
    this._addAttribute(name, {
        type: dataTypes.NOMINAL,
        values: values,
        nominals: {}
    });
};

arff.prototype._addAttribute = function(name, dataType) {
    if (!this.headerMode) {
        throw new Error("cannot add more attributes after adding data");
    }
    this.attributesMap[name] = dataType;
    this.attributesArr.push({
        name: name,
        data: dataType
    });
};

arff.prototype.scanForRedundantNominals = function() {
    var self = this;
    if (this.skipRedundantNominal) {
        _.each(this.attributesArr, function(val, index) {
            if (val.data.type == dataTypes.NOMINAL && val.data.values.length < 2) {
                self.attributesArr[index] = undefined;
            } else {
                self.lastIndex = index;
            }
        });
        if (util.isNullOrUndefined(this.lastIndex)) {
            throw new Error("after skipping redundant nominals no attributes are left");
        }
    } else {
        this.lastIndex = this.attributesArr.length - 1;
    }

};

arff.prototype.addData = function(data) {
    if (this.headerMode) {
        this.headerMode = false;
        this.scanForRedundantNominals();
    }
    this.data.push(data);
};

function escape(str, ch, rgx) {
    if (util.isNullOrUndefined(str)) {
        return "";
    }
    if (_.isNumber(str)) {
        str = str.toString();
    }
    if (util.isNullOrUndefined(ch)) {
        ch = "'";
    }
    if (util.isNullOrUndefined(rgx)) {
        rgx = /\s/g;
    }
    if (rgx.test(str)) {
        return ch + str + ch;
    }
    return str;
}



arff.prototype.writeHeaderToStream = function() {
    this.writer.writeLine("@RELATION", escape(this.relation));
    this.writer.writeLine();
    var self = this;
    this.attributesArr.forEach(function(att) {
        if (isDefined(att)) {
            switch (att.data.type) {
                case dataTypes.DATE:
                    self.writer.writeLine(ATTRIBUTE, escape(att.name), att.data.type, escape(att.data.format, '"', /./));
                    break;
                case dataTypes.NOMINAL:
                    var attVals = _.reduce(att.data.values, function(memo, v) {
                        return memo + escape(v) + ",";
                    }, "{");
                    attVals = attVals.substr(0, attVals.length - 1) + "}";
                    self.writer.writeLine(ATTRIBUTE, escape(att.name), attVals);
                    break;
                default:
                    self.writer.writeLine(ATTRIBUTE, escape(att.name), att.data.type);
                    break;
            }
        }
    });
    self.writer.writeLine();
    self.writer.writeLine(DATA);
};

arff.prototype.writeToStream = function(strm) {
    this.writer = new writer(strm);
    this.writeHeaderToStream();
    switch (this.mode) {
        case MODES.CSV:
            var readable = new arrayToStream(this.data, {
                delim: EOL
            });
            var csvReader = new Csvly(readable, {
                array: true
            });
            csvReader.on('line', this.handler);
            csvReader.read();
            break;
        default:
            this.data.forEach(this.handler);
            break;

    }
}

arff.prototype.writeToFile = function(p) {
    this.writeToStream(fs.createWriteStream(p));
};

arff.prototype.parseCsv = function(input, output, options) {
    var self = this;
    this.parseMode = true;
    this.setMode(MODES.ARRAY);
    var start = 0;
    var count = undefined;
    var autoNominals = false;
    this.writer = new writer(output);
    var reader;

    if (isDefined(options)) {
        if (isDefined(options.start)) {
            start = options.start;
        }
        if (isDefined(options.count)) {
            count = options.count;
        }
        if (isDefined(options.autoNominals)) {
            autoNominals = options.autoNominals;
        }
    }
    var opts = {
        array: true
    };

    var readData = function() {
        self.scanForRedundantNominals();
        self.writeHeaderToStream();
        reader = new Csvly(input, opts);
        reader.on('line', self.handler);
        reader.read(start, count);
    }

    if (autoNominals) {
        reader = new Csvly(input, opts);
        reader.on('line', function(data) {
            for (var i = 0; i < data.length; i++) {
                if (self.attributesArr[i].data.type == dataTypes.NOMINAL) {
                    if (util.isNullOrUndefined(self.attributesArr[i].data.nominals[data[i]])) {
                        self.attributesArr[i].data.nominals[data[i]] = 1;
                    }
                }
            }
        });
        reader.on('end', function() {
            for (var i = 0; i < self.attributesArr.length; i++) {
                self.attributesArr[i].data.values = [];
                if (self.attributesArr[i].data.type == dataTypes.NOMINAL) {
                    Object.keys(self.attributesArr[i].data.nominals).forEach(function(v) {
                        if (isDefined(self.reduce)) {
                            if (isDefined(self.reduce[v])) {
                                v = self.reduce[v];
                            }
                        }
                        self.attributesArr[i].data.values.push(v);
                    });
                }
            }
            readData();
        });
        reader.read(start, count);
    } else {
        readData();
    }
}

module.exports = {
    ArffWriter: arff,
    MODE_OBJECT: "OBJECT",
    MODE_ARRAY: "ARRAY",
    MODE_CSV: "CSV"
};
