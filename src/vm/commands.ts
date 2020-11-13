import {V3OfflineSettingsLoader} from './v3-offline-settings';
import {randomBytes} from 'crypto';
import * as path from 'path';
import {DownloadCache} from './download-cache';
import {foodDatabaseFileName, imageDatabaseFileName, systemDatabaseFileName} from './constants';
import {VirtualBoxUtils} from './virtualbox-utils';
import {Logger} from '../utils';
import {ensureDirectoryExists} from '../homedir';
import {V4DevSettingsLoader} from './v4-dev-settings';
import {V3Deployment} from './v3-deployment';
import {V4Deployment} from './v4-deployment';
import Vorpal = require('vorpal');

export default class VirtualMachineCommands {

    private readonly homeDirectoryPath: string;
    private readonly logger: Logger;
    private readonly v3settingsLoader: V3OfflineSettingsLoader;
    private readonly v4settingsLoader: V4DevSettingsLoader;
    private readonly download: DownloadCache;

    constructor(homeDirectoryPath: string, defaultDumpDirectory: string, logger: Logger) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.logger = logger;
        this.v3settingsLoader = new V3OfflineSettingsLoader(homeDirectoryPath, logger);
        this.v4settingsLoader = new V4DevSettingsLoader(homeDirectoryPath, defaultDumpDirectory, logger);
        this.download = new DownloadCache(logger);
    }

    register(vorpal: Vorpal): void {

        vorpal
            .command('vm v3 offline', 'Creates an Intake24 V3 VirtualBox VM for offline deployment.')
            .option('-i, --id', 'Build ID override')
            .action(async args => {

                let settings = await this.v3settingsLoader.load();
                const buildId = (settings.buildIdOverride) ? settings.buildIdOverride : randomBytes(8).toString('hex');

                let virtualBox = new VirtualBoxUtils(settings.virtualBox.command, this.logger);
                let deployment = new V3Deployment(settings, buildId, this.logger);

                const buildDirectory = path.resolve(this.homeDirectoryPath, buildId);

                const homeDirectory = settings.homeDirectoryOverride || this.homeDirectoryPath;

                const downloadsDirectoryName = 'v3-offline-cache';
                const imageFileName = 'intake24_v3_offline_base.ova';

                const downloadsDirectory = path.resolve(homeDirectory, downloadsDirectoryName);


                await ensureDirectoryExists(downloadsDirectory);

                const imageFilePath = path.resolve(downloadsDirectory, imageFileName);
                const systemDatabaseFilePath = path.resolve(downloadsDirectory, systemDatabaseFileName);
                const foodDatabaseFilePath = path.resolve(downloadsDirectory, foodDatabaseFileName);
                const imageDatabaseFilePath = path.resolve(downloadsDirectory, imageDatabaseFileName);


                this.logger.log(this.logger.bold(`Verifying and downloading resources...`));
                this.logger.log(`Using ${this.logger.highlight(downloadsDirectory)} for file downloads`);

                this.logger.log(`Base VM image:`);
                await this.download.ensureFileExists(imageFilePath, settings.ova.sha256, settings.ova.downloadUrl, settings.skipIntegrityChecks);

                this.logger.log(`System database:`);
                await this.download.ensureFileExists(systemDatabaseFilePath, settings.systemDatabase.sha256, settings.systemDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                this.logger.log(`Food database:`);
                await this.download.ensureFileExists(foodDatabaseFilePath, settings.foodDatabase.sha256, settings.foodDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                this.logger.log(`Image database:`);
                await this.download.ensureFileExists(imageDatabaseFilePath, settings.imageDatabase.sha256, settings.imageDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                this.logger.log(`Starting build (id: ${this.logger.highlight(buildId)})`);

                const vmName = `${settings.virtualBox.vmname} ${buildId}`;


                if (settings.virtualBox.homeDirectoryOverride) {
                    await virtualBox.import(`${settings.virtualBox.homeDirectoryOverride}/${downloadsDirectoryName}/${imageFileName}`, vmName);
                } else {
                    await virtualBox.import(imageFilePath, vmName);
                }

                await virtualBox.start(vmName);

                await deployment.initInstanceDirectory();

                await deployment.createDeployUser();

                await deployment.switchToDeployUser();

                await deployment.configureNginx();

                await deployment.configureJava();

                await deployment.createDatabases(downloadsDirectory);

                await deployment.installApiServer();

                await deployment.copyImages(downloadsDirectory);

                await deployment.installRespondentFrontend();

                await deployment.installAdminFrontend();

            });

        vorpal
            .command('vm v4 dev', 'Creates an Intake24 V4 VM with development dependencies.')
            .option('-i, --id', 'Build ID override')
            .action(async args => {

                let settings = await this.v4settingsLoader.load();

                const buildId = (settings.buildIdOverride) ? settings.buildIdOverride : randomBytes(8).toString('hex');
                const homeDirectory = settings.homeDirectoryOverride || this.homeDirectoryPath;

                const downloadsDirectoryName = 'v4-dev-cache';
                const imageFileName = 'intake24_v4_dev_base.ova';

                const downloadsDirectory = path.resolve(homeDirectory, downloadsDirectoryName);

                await ensureDirectoryExists(downloadsDirectory);

                const virtualBox = new VirtualBoxUtils(settings.virtualBox.command, this.logger);
                const deployment = new V4Deployment(settings, buildId, this.logger);

                const imageFilePath = path.resolve(downloadsDirectory, imageFileName);

                this.logger.log(this.logger.bold(`Verifying and downloading resources...`));
                this.logger.log(`Using ${this.logger.highlight(downloadsDirectory)} for file downloads`);

                this.logger.log(`Base VM image:`);
                await this.download.ensureFileExists(imageFilePath, settings.baseOva.sha256, settings.baseOva.downloadUrl, settings.skipIntegrityChecks);

                this.logger.log(this.logger.bold(`Starting build (id: ${this.logger.highlight(buildId)})`));

                const vmName = `${settings.virtualBox.vmname} ${buildId}`;

                if (settings.virtualBox.homeDirectoryOverride) {
                    await virtualBox.import(`${settings.virtualBox.homeDirectoryOverride}/${downloadsDirectoryName}/${imageFileName}`, vmName);
                } else {
                    await virtualBox.import(imageFilePath, vmName);
                }

                await virtualBox.start(vmName);

                await deployment.initInstanceDirectory();

                await deployment.createDeployUser();

                await deployment.createDatabases();

            });
    }
}
