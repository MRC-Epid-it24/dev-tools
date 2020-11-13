import {execDisplayOutput} from '../exec-utils';
import {Logger} from '../utils';

export class VirtualBoxUtils {
    private readonly command: string;
    private readonly logger: Logger;

    constructor(command: string, logger: Logger) {
        this.command = command;
        this.logger = logger;
    }

    async exec(args: ReadonlyArray<string>): Promise<void> {
        return await execDisplayOutput(this.command, args);
    }

    async import(imagePath: string, name: string): Promise<void> {
        this.logger.log(`Importing "${this.logger.highlight(imagePath)}" into VirtualBox as "${this.logger.highlight(name)}"...`);
        return await this.exec(['import', imagePath, '--vsys', '0', '--vmname', name]);
    }

    async start(name: string): Promise<void> {
        this.logger.log(`Starting VM: ${name}...`);
        return await this.exec(['startvm', name, '--type', 'headless']);
    }
}
