"use strict";

const util = require('util');

const chalk = require('chalk');
const moment = require('moment');


const levels = {};
const reverseLevels = {};
[
    {value: 1, name: chalk.red('SEVERE')},
    {value: 2, name: chalk.yellow('WARNING')},
    {value: 3, name: chalk.blue('INFO')},
    {value: 4, name: chalk.cyan('FINE')},
    {value: 5, name: chalk.gray('FINER')},
    {value: 6, name: chalk.gray('FINEST')},
].forEach(function (level) {
        Object.defineProperty(levels, chalk.stripColor(level.name), {
            value: level.value,
            enumerable: true,
        });
        reverseLevels[level.value] = level.name;
    });
Object.freeze(levels);


/**
 * Constructs a new Logger instance.
 *
 * Additional options are:
 *   - options.streams: Map<Stream, Set<Integer>>
 *     Defines the output streams in which the logs should be placed.
 *     The Set should contain all applicable log levels for the stream.
 *
 * @param {string} [name]          The name of this logger instance.
 * @param {number} [level=WARNING] A valid log level.
 * @param {object} [options]       Additional options.
 *
 * @constructor
 */
function Logger(name, level, options) {
    this.name = name;

    __hidden(this, '__level', levels.WARNING);

    __virtual(this, 'level', function getLevel() {
        return this.__level;
    }, function setLevel(level) {
        level = Number(level);
        if (!Number.isInteger(level)) {
            throw new Error('Invalid loglevel provided!');
        }

        this.__level = Number(level);
    });

    let levelsList = Object.keys(levels).map(function (key) {
        return levels[key];
    });

    __hidden(this, '__streams', new Map([
        [process.stdout, new Set(levelsList)],
    ]));

    if (level != null) {
        this.level = level;
    }

    if (options == null) {
        options = {};
    }

    if (options.streams != null) {
        this.__streams = options.streams;
    }
}

Object.defineProperty(Logger, 'levels', {
    value: levels,
    enumerable: true,
});

Logger.prototype = {

    /**
     * Logs a message.
     *
     * @param {number} level    A valid log level.
     * @param {...*}   messages The message(s) to log.
     *
     * @public
     */
    log: function log(level, messages) {
        let now = new Date();

        if (level > this.level) {
            return;
        }

        let self = this;
        let instLevel = this.level;
        let args = arguments;

        setImmediate(function () {
            args = Array.prototype.slice.call(args, 0);
            args.unshift(instLevel);
            args.unshift(now);
            __write.apply(self, args);
        });
    },
};

Object.keys(levels).forEach(function (level) {
    Logger.prototype[level.toLowerCase()] = function () {
        let args = Array.prototype.slice.call(arguments, 0);
        args.unshift(levels[level]);

        this.log.apply(this, args);
    };
});

exports = module.exports = Logger;


/**
 * Adds a hidden property to an object.
 *
 * @param {object} inst     The object to add to.
 * @param {string} name     The name of the property.
 * @param {*}      [value]  (Optional) The default value.
 *
 * @private
 */
function __hidden(inst, name, value) {
    Object.defineProperty(inst, name, {
        value: value,
        writable: true,
        enumerable: false,
        configurable: false,
    });
}

/**
 * Adds a virtual property to an object.
 *
 * @param {object}   inst       The object to add to.
 * @param {string}   name       The name of the property/
 * @param {function} getter     The getter method.
 * @param {function} [setter]   (Optional) The setter method.
 */
function __virtual(inst, name, getter, setter) {
    let props = {
        get: getter,
        enumerable: true,
    };

    if (setter != null) {
        props.set = setter;
    }

    Object.defineProperty(inst, name, props);
}

/**
 * Logs a message.
 *
 * @param {Date}   date         The time at which the log method was called.
 * @param {Number} instLevel    The log level of the logger, at the time of calling.
 * @param {Number} messageLevel The level at which the message was logged.
 * @param {...*}   messages     The message(s) to log.
 *
 * @private
 */
function __write(date, instLevel, messageLevel, messages) {
    let timestamp = moment(date).format('YYYY-MM-DD HH:mm:ss');

    messages = Array.prototype.slice.call(arguments, 3);
    let message = util.format.apply(util, messages);

    let prefix = util.format('[%s][%s][%s]',
        chalk.blue(timestamp),
        this.name == null ? '' : chalk.magenta(this.name),
        reverseLevels[messageLevel]);

    let self = this;
    let sep = '***';
    message.replace(/\r/g, '').split(/\n/).forEach(function (line) {
        for (let keyVal of self.__streams) {
            let stream = keyVal[0];
            let applicableLevels = keyVal[1];

            if (applicableLevels.has(messageLevel)) {
                stream.write([prefix, sep, line].join(' ') + '\n');
            }
        }

        sep = '   ';
    });
}
