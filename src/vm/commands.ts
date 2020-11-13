import {VirtualMachineSettingsLoader} from './settings';
import {randomBytes} from 'crypto';
import * as path from 'path';
import {DownloadCache} from './download-cache';
import {DeploymentUtils} from './deployment-utils';
import {
    downloadsDirectoryName,
    foodDatabaseFileName,
    imageDatabaseFileName,
    imageFileName,
    systemDatabaseFileName
} from './constants';
import {VirtualBoxUtils} from './virtualbox-utils';
import {VorpalLogger} from '../utils';
import Vorpal = require('vorpal');
import {ensureDirectoryExists} from '../homedir';

export default class VirtualMachineCommands {

    private readonly homeDirectoryPath: string;
    private readonly settingsLoader: VirtualMachineSettingsLoader;

    constructor(homeDirectoryPath: string, settingsLoader: VirtualMachineSettingsLoader) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.settingsLoader = settingsLoader;
    }

    register(vorpal: Vorpal) {

        vorpal
            .command('vm v3 offline', 'Creates an Intake24 V3 VirtualBox VM for offline deployment.')
            .option('-i, --id', 'Build ID override')
            .action(async args => {

                let logger = new VorpalLogger(vorpal);
                let settings = await this.settingsLoader.load();
                let vbox = new VirtualBoxUtils(settings.virtualBox.command, logger);
                let download = new DownloadCache(logger);

                const buildId = (settings.buildIdOverride) ? settings.buildIdOverride : randomBytes(8).toString('hex');
                const buildDirectory = path.resolve(this.homeDirectoryPath, buildId);

                const homeDirectory = settings.homeDirectoryOverride || this.homeDirectoryPath;

                const downloadsDirectory = path.resolve(homeDirectory, downloadsDirectoryName);

                await ensureDirectoryExists(downloadsDirectory);

                const imageFilePath = path.resolve(downloadsDirectory, imageFileName);
                const systemDatabaseFilePath = path.resolve(downloadsDirectory, systemDatabaseFileName);
                const foodDatabaseFilePath = path.resolve(downloadsDirectory, foodDatabaseFileName);
                const imageDatabaseFilePath = path.resolve(downloadsDirectory, imageDatabaseFileName);


                logger.log(logger.bold(`Verifying and downloading resources...`));
                logger.log(`Using ${logger.highlight(downloadsDirectory)} for file downloads`);

                logger.log(`Base VM image:`);
                await download.ensureFileExists(imageFilePath, settings.ova.sha256, settings.ova.downloadUrl, settings.skipIntegrityChecks);

                logger.log(`System database:`);
                await download.ensureFileExists(systemDatabaseFilePath, settings.systemDatabase.sha256, settings.systemDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                logger.log(`Food database:`);
                await download.ensureFileExists(foodDatabaseFilePath, settings.foodDatabase.sha256, settings.foodDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                logger.log(`Image database:`);
                await download.ensureFileExists(imageDatabaseFilePath, settings.imageDatabase.sha256, settings.imageDatabase.downloadUrl,
                    settings.skipIntegrityChecks);

                logger.log(`Starting build (id: ${logger.highlight(buildId)})`);

                const vmName = `${settings.virtualBox.vmname} ${buildId}`;


                if (settings.virtualBox.homeDirectoryOverride) {
                    await vbox.import(`${settings.virtualBox.homeDirectoryOverride}/${downloadsDirectoryName}/${imageFileName}`, vmName);
                } else {
                    await vbox.import(imageFilePath, vmName);
                }

                await vbox.start(vmName);

                const deployment = new DeploymentUtils(settings, buildId, logger);

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
    }
}
