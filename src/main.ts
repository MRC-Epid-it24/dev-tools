import Vorpal = require('vorpal');
import Chalk = require('chalk');
import {ensureHomeDirectoryExists} from './homedir';
import DatabaseProfileCommands from './databases';
import {Settings, SettingsLoader} from './settings';

const vorpal = new Vorpal();

vorpal.log(Chalk.whiteBright('\nWelcome to Intake24 developer toolkit!\n'));
vorpal.log('Type "help" to get started.');

let homeDirectoryOverride = process.argv[2];

ensureHomeDirectoryExists(homeDirectoryOverride).then(
    homeDir => {
        if (homeDir.created) {
            vorpal.log('\nCreated new directory for settings and cached data at ' + Chalk.blueBright(homeDir.path));
        }

        const settingsLoader = new SettingsLoader(homeDir.path);

        settingsLoader.load().then(_ => {
            new DatabaseProfileCommands(homeDir.path, settingsLoader).register(vorpal);

            vorpal
                .delimiter('>')
                .show();
        });
    });
