import Vorpal = require('vorpal');
import Chalk = require('chalk');
import {ensureHomeDirectoryExists} from './homedir';
import DatabaseProfileCommands from './databases';
import {Settings, SettingsLoader} from './settings';
import VirtualMachineCommands from './vm/commands';
import {VirtualMachineSettingsLoader} from './vm/settings';

const vorpal = new Vorpal();

vorpal.log(Chalk.whiteBright('\nWelcome to the Intake24 developer toolkit!\n'));
vorpal.log('Type "help" to get started.');

let homeDirectoryOverride = process.argv[2];

ensureHomeDirectoryExists(homeDirectoryOverride).then(
    homeDir => {
        if (homeDir.created) {
            vorpal.log('\nCreated new directory for settings and cached data at ' + Chalk.blueBright(homeDir.path));
        }

        const settingsLoader = new SettingsLoader(homeDir.path);
        const vmSettingsLoader = new VirtualMachineSettingsLoader(homeDir.path);

        settingsLoader.load().then(_ => {
            new DatabaseProfileCommands(homeDir.path, settingsLoader).register(vorpal);
            new VirtualMachineCommands(homeDir.path, vmSettingsLoader).register(vorpal);

            vorpal
                .delimiter('>')
                .show();
        });
    });
