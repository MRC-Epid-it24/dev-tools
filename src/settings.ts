import * as fs from 'fs';
import validate from './settings.validator';
import * as path from 'path';
import {Constants} from './constants';
import Chalk = require('chalk');

export interface Settings {
    pgDumpCommand: string;
    defaultDumpDirectory: string;
}

export class SettingsLoader {

    readonly defaults: Settings;
    readonly homeDirectoryPath: string;

    constructor(homeDirectoryPath: string) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.defaults = {
            pgDumpCommand: 'pg_dump',
            defaultDumpDirectory: path.join(homeDirectoryPath, 'data-dumps')
        };
    }

    async load(): Promise<Settings> {

        const settingsFilePath = path.join(this.homeDirectoryPath, Constants.settingsFileName);

        try {
            let fileContents = await fs.promises.readFile(settingsFilePath, {encoding: 'utf8'});
            return validate(JSON.parse(fileContents));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }

            console.log('\nCreated a default settings file at ' + Chalk.blueBright(settingsFilePath) + ', please review and/or edit before continuing.');

            await fs.promises.writeFile(settingsFilePath, JSON.stringify(this.defaults, null, 4));

            return this.defaults;
        }
    }
}
