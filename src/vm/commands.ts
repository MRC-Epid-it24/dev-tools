import {VirtualMachineSettingsLoader} from './settings';
import Vorpal = require('vorpal');


export default class VirtualMachineCommands {

    private readonly homeDirectoryPath: string;
    private settingsLoader: VirtualMachineSettingsLoader;

    constructor(homeDirectoryPath: string, settingsLoader: VirtualMachineSettingsLoader) {
        this.homeDirectoryPath = homeDirectoryPath;
        this.settingsLoader = settingsLoader;
    }

    register(vorpal: Vorpal) {
        vorpal
            .command('vm create', 'Creates an Intake24 VirtualBox VM for offline deployment.')
            .option('-i, --id', 'Build ID override')
            .action(args => {
                throw new Error('Not implemented');
            });
    }
}
