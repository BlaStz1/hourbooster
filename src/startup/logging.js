const { loggers, format, transports } = require('winston');
const chalk = require('chalk');
const timestamp = require('../utils/timestamp.util');

// Tag factory like your custom logger
const tagFactory = (label, color) =>
  chalk.white.bold('[') + color.bold(` ${label} `) + chalk.white.bold(']');

const tag = {
  OK: tagFactory('OK ', chalk.green),
  ERR: tagFactory('ERR', chalk.red),
  INF: tagFactory('INF', chalk.blue),
};

// Custom formatter using tags
const loggerFormat = format.printf(({ level, message, timestamp: ts }) => {
  let prefix;
  switch (level) {
    case 'info':
      prefix = tag.INF;
      break;
    case 'error':
      prefix = tag.ERR;
      break;
    case 'warn':
      prefix = tagFactory('WRN', chalk.yellow);
      break;
    case 'debug':
      prefix = tagFactory('DBG', chalk.magenta);
      break;
    default:
      prefix = tagFactory(level.toUpperCase(), chalk.white);
      break;
  }

  return `${prefix} [${chalk.gray(ts)}] ${message}`;
});

module.exports = () => {
  loggers.add('default', {
    level: 'info',
    exitOnError: true,
    format: format.combine(
      format.timestamp({ format: timestamp }),
      loggerFormat,
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: './logs/combined.log' }),
    ],
  });

    loggers.add('default', {
    level: 'ok',
    exitOnError: true,
    format: format.combine(
      format.timestamp({ format: timestamp }),
      loggerFormat,
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: './logs/combined.log' }),
    ],
  });

  // Error handling
  process.on('uncaughtException', (error) => {
    loggers.get('default').error(error.stack || error.message || error);
    process.exitCode = 1;
  });

  process.on('unhandledRejection', (error) => {
    loggers.get('default').error(error.stack || error.message || error);
    process.exitCode = 1;
  });
};
