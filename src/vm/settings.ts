import * as path from 'path';
import {Constants} from '../constants';
import * as fs from 'fs';
import Chalk from 'chalk';
import validate from './settings.validator'

export interface VirtualBoxSettings {
    homeDirectoryOverride?: string;
    command: string;
    vmname: string;
    ip4address: string;
}

export interface DownloadableResource {
    downloadUrl: string;
    sha256: string;
}

export interface DeploymentSettings {
    ansiblePlaybookCommand: string;
    directory: string;

}

export interface ApiServerSettings {
    dataExportServiceDebianPackagePath: string;
    port: number;
    v1debianPackagePath: string;
    v2jarPath: string;
    playSecret: string
}

export interface AdminSettings {
    port: number
}

export interface FrontendSettings {
    port: number,
    debianPackagePath: string
}

export interface Settings {
    buildIdOverride?: string;
    skipIntegrityChecks: boolean;
    homeDirectoryOverride?: string;

    virtualBox: VirtualBoxSettings;
    deployment: DeploymentSettings;
    apiServer: ApiServerSettings;
    admin: AdminSettings;
    frontend: FrontendSettings;

    ova: DownloadableResource;
    systemDatabase: DownloadableResource;
    foodDatabase: DownloadableResource;
    imageDatabase: DownloadableResource;
}


export class VirtualMachineSettingsLoader {

    readonly defaults: Settings;
    readonly homeDirectoryPath: string;

    constructor(homeDirectoryPath: string) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.defaults = {
            ova: {
                downloadUrl: 'https://intake24.s3-eu-west-1.amazonaws.com/vm/Intake24_Local_Base_08052020.ova',
                sha256: '3300128d5b220942612e1d35c1431590d2f674f4f80cbd592918a8330c4543df'
            },
            systemDatabase: {
                downloadUrl: 'https://intake24.s3-eu-west-1.amazonaws.com/init/intake24_system_init_v97.zip',
                sha256: '9c4466f654d8790a11c384ae4e3e2e7edee089a2a5dcb0ef575d1494a2890110'
            },
            foodDatabase: {
                downloadUrl: 'https://intake24.s3-eu-west-1.amazonaws.com/init/intake24_foods_ndns_04052020',
                sha256: '131a95050ccb23fce4daed700926a710ea068a37171a1175c956acce8cc46e51'
            },
            imageDatabase: {
                downloadUrl: 'https://intake24.s3-eu-west-1.amazonaws.com/init/images-ndns-020320.zip',
                sha256: 'c152afe28e60f813c43ef7d5ab7ffdef2cea03daedc764aea5c4bb869ae20586'
            },
            admin: {
                port: 8082,
            },
            frontend: {
                port: 8081,
                debianPackagePath: '/path/to/survey-frontend/SurveyServer/target/intake24-survey-site_3.0.0-SNAPSHOT_all.deb'
            },

            skipIntegrityChecks: false,
            virtualBox: {
                command: 'vboxmanage',
                vmname: 'Intake24 Local Build',
                ip4address: '192.168.56.10'
            },
            deployment: {
                ansiblePlaybookCommand: 'ansible-playbook',
                directory: '/path/to/deployment/scripts'
            },
            apiServer: {
                port: 9001,
                v1debianPackagePath: '/path/to/intake24-api-server_3.30.2-SNAPSHOT_all.deb',
                v2jarPath: '/path/to/intake24-api-v2-1.0.0-all.jar',
                dataExportServiceDebianPackagePath: '/path/to/intake24-data-export_4.2.0-SNAPSHOT_all.deb',
                playSecret: 'generate with apiPlayServer/playGenerateSecret'
            }
        }
    }


    async load(): Promise<Settings> {

        const settingsFilePath = path.join(this.homeDirectoryPath, Constants.vmBuilderSettingsFileName);

        try {
            let fileContents = await fs.promises.readFile(settingsFilePath, {encoding: 'utf8'});
            return validate(JSON.parse(fileContents));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }

            console.log('\nCreated a default VM builder settings file at ' + Chalk.blueBright(settingsFilePath) + ', please review and/or edit before continuing.');

            await fs.promises.writeFile(settingsFilePath, JSON.stringify(this.defaults, null, 4));

            return this.defaults;
        }
    }
}
