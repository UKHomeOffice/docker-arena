const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('handlebars');
const exphbs = require('express-handlebars');
const Bull = require('bull');

const port = process.env.ARENA_PORT || 8080;
const redisUrl = process.env.REDIS_URL || localhost;
const redisPort = process.env.REDIS_PORT || 6379;
const redisToken = process.env.REDIS_TOKEN || "";
const redisSSL = process.env.REDIS_SSL || false;


class Queues {
  constructor(config) {
    this._queues = {};

    this.useCdn = {
      value: true,
      get useCdn() {
        return this.value;
      },
      set useCdn(newValue) {
        this.value = newValue;
      }
    };

    this.setConfig(config);
  }

  list() {
    return this._config.queues;
  }

  setConfig(config) {
    this._config = config;
  }

  async get(queueName, queueHost) {
    const queueConfig = _.find(this._config.queues, {
      name: queueName,
      hostId: queueHost
    });
    if (!queueConfig) return null;

    if (this._queues[queueHost] && this._queues[queueHost][queueName]) {
      return this._queues[queueHost][queueName];
    }

    const { type, name, port, host, db, password, prefix, url, redis, tls } = queueConfig;

    const redisHost = { host };
    if (password) redisHost.password = password;
    if (port) redisHost.port = port;
    if (db) redisHost.db = db;
    if (tls) redisHost.tls = tls;

    const isBee = type === 'bee';

    const options = {
      redis: redis || url || redisHost
    };
    if (prefix) options.prefix = prefix;

    let queue;
    if (isBee) {
      _.extend(options, {
        isWorker: false,
        getEvents: false,
        sendEvents: false,
        storeJobs: false
      });

      queue = new Bee(name, options);
      queue.IS_BEE = true;
    } else {
      if (queueConfig.createClient) options.createClient = queueConfig.createClient;
      queue = new Bull(name, options);
    }

    this._queues[queueHost] = this._queues[queueHost] || {};
    this._queues[queueHost][queueName] = queue;

    return queue;
  }

  /**
   * Creates and adds a job with the given `data` to the given `queue`.
   *
   * @param {Object} queue A bee or bull queue class
   * @param {Object} data The data to be used within the job
   */
  async set(queue, data) {
    if (queue.IS_BEE) {
      return queue.createJob(data).save();
    } else {
      return queue.add(data, {
        removeOnComplete: false,
        removeOnFail: false
      });
    }
  }
}

module.exports = Queues;

const createQueue = (appConfig,
  pdf-queue) {

  if (redisSSL) {
    return new Bull(name, {
      redis: {
        port: redisPort,
        host: redisUrl,
        password: redisToken,
        tls: {},
        },
      });
    }
    return new Bull(name, {
    redis: {
      port: redisPort,
      host: redisUrl,
      password: redisToken,
      },
    });
};

module.exports = function() {
  const hbs = exphbs.create({
    defaultLayout: `${__dirname}/views/layout`,
    handlebars,
    partialsDir: `${__dirname}/views/partials/`,
    extname: 'hbs'
  });

  require('handlebars-helpers')({handlebars});

  const app = express();

  const Queues = require('./queue');
;
  require('./views/helpers/handlebars')(handlebars, { createQueue });
  app.locals.Queues = createQueue;
  app.locals.appBasePath = '';
  app.locals.vendorPath = '/vendor';

  app.set('views', `${__dirname}/views`);
  app.set('view engine', 'hbs');
  app.set('json spaces', 2);
  app.set('port', port);

  app.engine('hbs', hbs.engine);

  app.use(bodyParser.json());

  return {
    app,
    Queues: app.locals.Queues
  };
};
