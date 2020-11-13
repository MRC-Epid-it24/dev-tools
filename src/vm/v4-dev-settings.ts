import * as path from 'path';

import {v4devSettingsFileName} from './constants';
import {DeploymentSettings, DownloadableResource, VirtualBoxSettings} from './v3-offline-settings';
import validate from './v4-dev-settings.validator';
import {AbstractSettingsLoader} from '../settings';
import {Logger} from '../utils';

export interface V4DevSettings {
    buildIdOverride?: string;
    skipIntegrityChecks: boolean;
    homeDirectoryOverride?: string;

    baseOva: DownloadableResource;

    virtualBox: VirtualBoxSettings;
    deployment: DeploymentSettings;

    databases: DatabaseInitSettings;
}

export interface DatabaseInitSettings {
    systemSchemaSnapshot: string,
    systemDataSnapshot: string,
    foodsSnapshot: string
}

export class V4DevSettingsLoader extends AbstractSettingsLoader<V4DevSettings> {

    readonly defaults: V4DevSettings;

    constructor(homeDirectoryPath: string, defaultDumpDirectory: string, logger: Logger) {
        super(path.resolve(homeDirectoryPath, v4devSettingsFileName), validate, logger);

        this.defaults = {
            baseOva: {
                downloadUrl: 'https://intake24.s3-eu-west-1.amazonaws.com/vm/intake24_v4_dev_base_13112020.ova',
                sha256: 'a02137ce24d9415258ae2dcda4ad7117ccbe4c7c0250f7f1d7849bb72894c9aa'
            },
            skipIntegrityChecks: false,
            virtualBox: {
                command: 'vboxmanage',
                vmname: 'Intake24 V4 Dev Build',
                ip4address: '192.168.56.4'
            },
            deployment: {
                ansiblePlaybookCommand: 'ansible-playbook',
                directory: '/path/to/deployment/scripts'
            },
            databases: {
                systemSchemaSnapshot: path.resolve(homeDirectoryPath, defaultDumpDirectory, 'intake24_system_schema'),
                systemDataSnapshot: path.resolve(homeDirectoryPath, defaultDumpDirectory, 'intake24_system_data'),
                foodsSnapshot: path.resolve(homeDirectoryPath, defaultDumpDirectory, 'intake24_system_foods')
            }
        };
    }
}
