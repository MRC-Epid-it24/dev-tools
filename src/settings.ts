import * as fs from 'fs';
import validate from './settings.validator';
import * as path from 'path';
import {Constants} from './constants';

import {Logger} from './utils';

export interface GlobalSettings {
    pgDumpCommand: string;
    pgRestoreCommand: string;
    psqlCommand: string;
    defaultDumpDirectory: string;
}

export abstract class AbstractSettingsLoader<T> {
    abstract readonly defaults: T;

    protected readonly settingsFilePath: string;
    protected readonly validate: (object: any) => T;
    protected readonly logger: Logger;

    constructor(settingsFilePath: string, validate: (object: any) => T, logger: Logger) {
        this.settingsFilePath = settingsFilePath;
        this.validate = validate;
        this.logger = logger;
    }

    async load(): Promise<T> {

        try {
            let fileContents = await fs.promises.readFile(this.settingsFilePath, {encoding: 'utf8'});
            return this.validate(JSON.parse(fileContents));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }

            this.logger.log(`Created a default settings file at ${this.logger.highlight(this.settingsFilePath)}, please review and/or edit before continuing.`);

            await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(this.defaults, null, 4));

            return this.defaults;
        }
    }
}

export class GlobalSettingsLoader extends AbstractSettingsLoader<GlobalSettings> {

    readonly defaults: GlobalSettings;

    constructor(homeDirectoryPath: string, logger: Logger) {
        super(path.resolve(homeDirectoryPath, Constants.settingsFileName), validate, logger);

        this.defaults = {
            pgDumpCommand: 'pg_dump',
            pgRestoreCommand: 'pg_restore',
            psqlCommand: 'psql',
            defaultDumpDirectory: path.join(homeDirectoryPath, 'data-dumps')
        };
    }
}
