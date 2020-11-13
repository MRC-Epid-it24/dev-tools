import Vorpal = require('vorpal');
import Chalk = require('chalk');
import {ensureHomeDirectoryExists} from './homedir';
import DatabaseProfileCommands from './databases';
import {GlobalSettingsLoader} from './settings';
import VirtualMachineCommands from './vm/commands';
import {VorpalLogger} from './utils';

const vorpal = new Vorpal();

vorpal.log(Chalk.whiteBright('\nWelcome to the Intake24 developer toolkit!\n'));
vorpal.log('Type "help" to get started.');

let homeDirectoryOverride = process.argv[2];

let logger = new VorpalLogger(vorpal);

ensureHomeDirectoryExists(homeDirectoryOverride).then(
    homeDir => {
        if (homeDir.created) {
            logger.log(`Created new directory for settings and cached data at ${logger.highlight(homeDir.path)}`);
        }

        const settingsLoader = new GlobalSettingsLoader(homeDir.path, logger);

        settingsLoader.load().then(settings => {
            new DatabaseProfileCommands(homeDir.path, settingsLoader).register(vorpal);
            new VirtualMachineCommands(homeDir.path, settings.defaultDumpDirectory, logger).register(vorpal);

            vorpal
                .delimiter('>')
                .show();
        });
    });
