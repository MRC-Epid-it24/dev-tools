import * as path from 'path';
import {Constants} from './constants';
import * as fs from 'fs';
import validate from './databases.validator';
import {SettingsLoader} from './settings';
import {execDisplayOutput} from './exec-utils';
import Vorpal = require('vorpal');
import Chalk = require('chalk');

export interface DatabaseConnectionParameters {
    host: string,
    port?: number,
    database: string,
    user: string,
    password?: string
}

export interface DatabaseProfile {
    system: DatabaseConnectionParameters,
    foods: DatabaseConnectionParameters
}

export interface DatabaseProfiles {
    [key: string]: DatabaseProfile
}

export default class DatabaseProfileCommands {

    private readonly homeDirectoryPath: string;
    private readonly profileFilePath: string;
    private settingsLoader: SettingsLoader;

    constructor(homeDirectoryPath: string, settingsLoader: SettingsLoader) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.settingsLoader = settingsLoader;
        this.profileFilePath = path.join(homeDirectoryPath, Constants.databaseProfilesFileName);
    }

    async load(): Promise<DatabaseProfiles> {
        try {
            let fileContents = await fs.promises.readFile(this.profileFilePath, {encoding: 'utf8'});
            return validate(JSON.parse(fileContents))
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        return {};
    }

    private async save(profiles: DatabaseProfiles): Promise<void> {
        return await fs.promises.writeFile(this.profileFilePath, JSON.stringify(profiles, null, 4));
    }

    private async delete(name: string): Promise<void> {
        let profiles = await this.load();

        if (!profiles[name]) {
            throw new Error(`Profile ${name} does not exist`);
        } else {
            delete profiles[name];
            await this.save(profiles);
        }
    }

    async init(name: string) {
        let profiles = await this.load();

        if (profiles[name]) {
            throw new Error(`Profile ${Chalk.blueBright(name)} already exists.`)
        } else {
            profiles[name] = {
                foods: {
                    host: '127.0.0.1',
                    port: 5432,
                    database: 'intake24_system',
                    user: 'intake24'
                },
                system: {
                    host: '127.0.0.1',
                    port: 5432,
                    database: 'intake24_system',
                    user: 'intake24'
                }
            };

            await this.save(profiles);
        }
    }

    async dumpSystem(name: string) {

    }

    register(vorpal: Vorpal) {
        vorpal
            .command('db list', 'Lists all known database profiles.')
            .action(args => this.load().then(profiles => {

                let names = Object.keys(profiles);

                if (names.length == 0) {
                    vorpal.activeCommand.log('No database profiles found.')
                } else {
                    for (let name of names.sort()) {
                        vorpal.activeCommand.log(' ' + name);
                    }
                }
            }));


        vorpal
            .command('db init <name>', 'Initializes a new database profile with default values.')
            .action(args => {

                let name = args['name'];

                return this.init(args['name']).then(() => {
                    vorpal.activeCommand.log(`Database profile ${Chalk.blueBright(name)} created.`);
                    vorpal.activeCommand.log('Please edit ' + Chalk.blueBright(this.profileFilePath) + ' to complete the configuration.');
                })
            });


        vorpal
            .command('db delete <name>', 'Deletes a database profile.')
            .action(args => {
                return this.load().then(profiles => {

                    let name = args['name'];

                    if (!profiles[name]) {
                        throw new Error(`Profile ${name} does not exist`);
                    } else {
                        return vorpal.activeCommand.prompt({
                            type: 'confirm',
                            name: 'continue',
                            default: false,
                            message: 'This action cannot be undone. Are you sure you want to delete this profile?',
                        }).then(result => {
                            if (result.continue) {
                                vorpal.activeCommand.log(`Database profile ${Chalk.blueBright(name)} deleted.`);
                                return this.delete(name);
                            }
                        });
                    }
                });
            });

        vorpal
            .command('db system dump <name> [path]', 'Creates a dump of the system database.')
            .option('-b, --blank', 'Create a blank dump that includes the schema and basic data but no sensitive data.')
            .action(async args => {
                let name = args['name'];
                let blank = args.options['blank'];

                let profiles = await this.load();

                let profile = profiles[name];

                if (!profile)
                    throw new Error(`Profile ${name} does not exist.`);

                let settings = await this.settingsLoader.load();

                let outputDirectoryPath = args['path'] || settings.defaultDumpDirectory;

                try {
                    let stats = await fs.promises.stat(outputDirectoryPath);
                    if (!stats.isDirectory())
                        throw new Error(Chalk.blueBright(outputDirectoryPath) + ' exists but is not a directory');
                } catch (err) {
                    await fs.promises.mkdir(outputDirectoryPath, {recursive: true})
                }

                let date = new Date();
                let timeStamp = `${date.getDay().toString().padStart(2, '0')}${date.getMonth().toString().padStart(2, '0')}${date.getFullYear().toString().substring(2)}`;

                let envVars = profile.system.password ? {PGPASSWORD: profile.system.password} : undefined;

                if (blank) {
                    let outputSchemaPath = path.join(outputDirectoryPath, `intake24_system_schema_${timeStamp}`);
                    let outputDataPath = path.join(outputDirectoryPath, `intake24_system_data_${timeStamp}`);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database schema')} to ${Chalk.blueBright(outputSchemaPath)}`);


                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                            '-Fc', '--schema-only', '--no-owner', '--no-acl', '-f', outputSchemaPath, profile.system.database],
                        undefined, envVars);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database data')} to ${Chalk.blueBright(outputDataPath)}`);

                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                            '-Fc', '--data-only', '--no-owner', '--no-acl', '-t', 'locales', '-t', 'nutrient-types', '-t', 'nutrient_units', '-t',
                            'local_nutrient_types', '-t', 'schema_version', '-t', 'flyway_migrations', '-f', outputDataPath, profile.system.database],
                        undefined, envVars);
                } else {
                    let outputPath = path.join(outputDirectoryPath, `intake24_system_${timeStamp}`);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database')} to ${Chalk.blueBright(outputPath)}`);

                    let envVars = profile.system.password ? {PGPASSWORD: profile.system.password} : undefined;

                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                        '-Fc', '--no-owner', '--no-acl', '-f', outputPath, profile.system.database], undefined, envVars);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database')} to ${Chalk.blueBright(outputPath)}`);
                }

                vorpal.activeCommand.log(Chalk.whiteBright('Done!'));
            });
    }
}
