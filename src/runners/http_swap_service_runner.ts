/**
 * This module can be used to run the Swap HTTP service standalone
 */

import bodyParser = require('body-parser');
import * as cors from 'cors';
import * as express from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import * as core from 'express-serve-static-core';
import { Server } from 'http';

import { AppDependencies, getDefaultAppDependenciesAsync } from '../app';
import * as defaultConfig from '../config';
import { SWAP_PATH } from '../constants';
import { rootHandler } from '../handlers/root_handler';
import { logger } from '../logger';
import { addressNormalizer } from '../middleware/address_normalizer';
import { errorHandler } from '../middleware/error_handling';
import { requestLogger } from '../middleware/request_logger';
import { createSwapRouter } from '../routers/swap_router';
import { providerUtils } from '../utils/provider_utils';

process.on('uncaughtException', err => {
    logger.error(err);
    process.exit(1);
});

process.on('unhandledRejection', err => {
    if (err) {
        logger.error(err);
    }
});

if (require.main === module) {
    (async () => {
        const provider = providerUtils.createWeb3Provider(defaultConfig.ETHEREUM_RPC_URL);
        const dependencies = await getDefaultAppDependenciesAsync(provider, defaultConfig);
        await runHttpServiceAsync(dependencies, defaultConfig);
    })().catch(error => logger.error(error.stack));
}

async function runHttpServiceAsync(
    dependencies: AppDependencies,
    config: { HTTP_PORT: string; HTTP_KEEP_ALIVE_TIMEOUT: number; HTTP_HEADERS_TIMEOUT: number },
    _app?: core.Express,
): Promise<Server> {
    const app = _app || express();
    app.use(requestLogger());
    app.use(cors());
    app.use(bodyParser.json());
    app.use(addressNormalizer);
    app.get('/', rootHandler);
    const server = app.listen(config.HTTP_PORT, () => {
        logger.info(`API (HTTP) listening on port ${config.HTTP_PORT}!`);
    });
    server.keepAliveTimeout = config.HTTP_KEEP_ALIVE_TIMEOUT;
    server.headersTimeout = config.HTTP_HEADERS_TIMEOUT;

    if (dependencies.swapService) {
        app.use(SWAP_PATH, createSwapRouter(dependencies.swapService));
    } else {
        logger.error(`Could not run swap service, exiting`);
        process.exit(1);
    }
    app.use(errorHandler);
    return server;
}
