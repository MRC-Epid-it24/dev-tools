import * as path from 'path';
import {Constants} from './constants';
import * as fs from 'fs';
import validate from './databases.validator';
import {GlobalSettingsLoader} from './settings';
import {execDisplayOutput} from './exec-utils';
import Vorpal = require('vorpal');
import Chalk = require('chalk');
import {getMostRecentFile, makeTimeStamp} from './utils';
import {createDatabase, databaseExists, dropDatabase, runPsqlCommand} from './database-utils';

export interface DatabaseConnectionParameters {
    host: string,
    port?: number,
    database: string,
    user: string,
    password?: string,
    superuser?: string,
    superuserPassword?: string
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
    private settingsLoader: GlobalSettingsLoader;

    constructor(homeDirectoryPath: string, settingsLoader: GlobalSettingsLoader) {
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
                    database: 'intake24_foods',
                    user: 'intake24',
                    superuser: 'postgres'
                },
                system: {
                    host: '127.0.0.1',
                    port: 5432,
                    database: 'intake24_system',
                    user: 'intake24',
                    superuser: 'postgres'
                }
            };

            await this.save(profiles);
        }
    }

    async dumpSystem(name: string) {

    }

    private getDropDatabaseSQL(database: string): string {
        return `
        -- Disallow new connections
        UPDATE pg_database SET datallowconn = 'false' WHERE datname = '${database}';
        ALTER DATABASE intake24_foods CONNECTION LIMIT 1;

        -- Terminate existing connections
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}';

        -- Drop database
        DROP DATABASE ${database};
        `
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
            .command('db system dump <profile_name> [path]', 'Creates a dump of the system database.')
            .option('-b, --blank', 'Create a blank dump that includes the schema and basic data but no sensitive data.')
            .action(async args => {
                let name = args['profile_name'];
                let blank = args.options['blank'];

                let profiles = await this.load();

                let profile = profiles[name];

                if (!profile)
                    throw new Error(`Profile ${name} does not exist.`);

                let settings = await this.settingsLoader.load();

                let outputDirectoryPath = args['path'] || settings.defaultDumpDirectory;

                await this.ensureDirectoryExists(outputDirectoryPath);

                let envVars = profile.system.password ? {PGPASSWORD: profile.system.password} : undefined;

                if (blank) {
                    let outputSchemaPath = path.join(outputDirectoryPath, `intake24_system_schema`);
                    let outputDataPath = path.join(outputDirectoryPath, `intake24_system_data`);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database schema')} to ${Chalk.blueBright(outputSchemaPath)}`);


                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                            '-Fc', '--schema-only', '--no-acl', '-f', outputSchemaPath, profile.system.database],
                        undefined, envVars);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database data')} to ${Chalk.blueBright(outputDataPath)}`);

                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                            '-Fc', '--data-only', '--no-acl', '-t', 'locales', '-t', 'nutrient_types', '-t', 'nutrient_units', '-t',
                            'local_nutrient_types', '-t', 'schema_version', '-t', 'flyway_migrations', '-f', outputDataPath, profile.system.database],
                        undefined, envVars);
                } else {
                    let outputPath = path.join(outputDirectoryPath, `intake24_system`);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database')} to ${Chalk.blueBright(outputPath)}`);

                    let envVars = profile.system.password ? {PGPASSWORD: profile.system.password} : undefined;

                    await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.system.host, '-U', profile.system.user,
                        '-Fc', '--no-owner', '--no-acl', '-f', outputPath, profile.system.database], undefined, envVars);

                    vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('system database')} to ${Chalk.blueBright(outputPath)}`);
                }

                vorpal.activeCommand.log(Chalk.whiteBright('Done!'));
            });

        vorpal
            .command('db foods dump <profile_name> [path]', 'Creates a dump of the foods database.')
            .action(async args => {
                let name = args['profile_name'];

                let profiles = await this.load();

                let profile = profiles[name];

                if (!profile)
                    throw new Error(`Profile ${name} does not exist.`);

                let settings = await this.settingsLoader.load();

                let outputDirectoryPath = args['path'] || settings.defaultDumpDirectory;

                await this.ensureDirectoryExists(outputDirectoryPath);

                let envVars = profile.foods.password ? {PGPASSWORD: profile.foods.password} : undefined;

                let outputPath = path.join(outputDirectoryPath, `intake24_foods`);

                vorpal.activeCommand.log(`Exporting ${Chalk.whiteBright('food database')} to ${Chalk.blueBright(outputPath)}`);

                await execDisplayOutput(settings.pgDumpCommand, ['-h', profile.foods.host, '-U', profile.foods.user,
                        '-Fc', '--no-owner', '--no-acl', '-f', outputPath, profile.foods.database],
                    undefined, envVars);


                vorpal.activeCommand.log(Chalk.whiteBright('Done!'));
            });

        vorpal
            .command('db system init <profile_name> [path]', 'Initializes an empty system database from a snapshot')
            .action(async args => {
                let profileName = args['profile_name'];

                let profiles = await this.load();

                let profile = profiles[profileName];

                if (!profile)
                    throw new Error(`Profile ${profileName} does not exist.`);

                let settings = await this.settingsLoader.load();

                if (await databaseExists(settings, profile.system)) {
                    let response = await vorpal.activeCommand.prompt({
                        type: 'confirm',
                        name: 'continue',
                        default: false,
                        message: 'Database ' + Chalk.blueBright(profile.system.database) + ' already exists for profile ' + Chalk.blueBright(profileName) +
                            '. The database will be deleted and all data will be lost! ' + Chalk.bgRed('This action cannot be undone.') + ' Are you sure you want to proceed?',
                    });

                    if (response.continue) {
                        vorpal.activeCommand.log(`Deleting database ${Chalk.blueBright(profile.system.database)}...`);

                        await dropDatabase(settings, profile.system);
                    } else {
                        return;
                    }
                }

                vorpal.activeCommand.log(`Creating database ${Chalk.blueBright(profile.system.database)}...`);

                await createDatabase(settings, profile.system);

                let schemaFilePath = args['path'];

                if (schemaFilePath) {
                    if (!args['path'].endsWith('_schema'))
                        throw new Error(`${Chalk.blueBright('path')} must point to a file ending in '_schema'`);

                    let schemaFileExists = await fs.promises.stat(schemaFilePath).then(_ => true).catch(_ => false);

                    if (!schemaFileExists)
                        throw new Error(`${schemaFilePath} does not exist.`);
                } else {
                    schemaFilePath = await getMostRecentFile(settings.defaultDumpDirectory,
                        (name: string) => name.startsWith('intake24_system_') && name.endsWith('_schema'));

                    if (!schemaFilePath)
                        throw new Error(`Could not find a system database dump in the default dump folder ${settings.defaultDumpDirectory}. Please specify the path to the dump file you want to use.`);
                }

                let schemaFileName = path.basename(schemaFilePath);
                let dataFileName = schemaFileName.replace(/schema$/, 'data');
                let dataFilePath = path.join(path.dirname(schemaFilePath), dataFileName);

                let dataFileExists = await fs.promises.stat(dataFilePath).then(_ => true).catch(_ => false);

                if (!dataFileExists) {
                    throw new Error(`Could not find the system database data file ${dataFilePath} ncorresponding to the schema file ${schemaFileName}`);
                } else {
                    if (!profile.system.superuser)
                        throw new Error('This operation requires superuser access and superuser settings are missing from the database profile');

                    vorpal.activeCommand.log(`Using most recent files in ${Chalk.blueBright(settings.defaultDumpDirectory)}`);

                    let envVars = profile.system.superuserPassword ? {PGPASSWORD: profile.system.superuserPassword} : undefined;

                    vorpal.activeCommand.log(`Importing system database schema from ${Chalk.blueBright(schemaFilePath)}...`);

                    await execDisplayOutput(settings.pgRestoreCommand, ['-h', profile.system.host, '-U', profile.system.user,
                        '-n', 'public', '--no-owner', '--dbname', profile.system.database, schemaFilePath], undefined, envVars);

                    vorpal.activeCommand.log(`Importing system database constants from ${Chalk.blueBright(dataFilePath)}...`);

                    await execDisplayOutput(settings.pgRestoreCommand, ['-h', profile.system.host, '-U', profile.system.user,
                        '-n', 'public', '--no-owner', '--dbname', profile.system.database, dataFilePath], undefined, envVars);

                    vorpal.activeCommand.log('Creating the default admin user...');

                    await runPsqlCommand(settings, profile.system, [],
                            `INSERT INTO users(name, email, phone, simple_name, email_notifications,
                                               sms_notifications)
                             VALUES ('Intake24 Admin', 'admin', null, 'intake24 admin', true, true)`, false);

                    await runPsqlCommand(settings, profile.system, [],
                            `INSERT INTO user_passwords (user_id, password_hash, password_salt, password_hasher)
                             VALUES (1, 'hU+SnrQ/+uAxfPyvpqCw9vixHzwC2Ph/Zqasd6CLgrE=', 'DWXIWvxIVfX1vBYfASmy0A==',
                                     'shiro-sha256')`, false);

                    await runPsqlCommand(settings, profile.system, [],
                            `INSERT INTO user_roles(user_id, role)
                             VALUES (1, 'superuser')`, false);

                    vorpal.activeCommand.log('Done!');

                }
            });
    }

    private async ensureDirectoryExists(directoryPath: string) {
        try {
            let stats = await fs.promises.stat(directoryPath);
            if (!stats.isDirectory())
                throw new Error(Chalk.blueBright(directoryPath) + ' exists but is not a directory');
        } catch (err) {
            await fs.promises.mkdir(directoryPath, {recursive: true})
        }
    }
}
