import * as path from 'path';
import {copy} from 'fs-extra';
// @ts-ignore
import replace from 'replace';
import {execDisplayOutput} from '../exec-utils';
import {Logger} from '../utils';

export abstract class DeploymentUtils {
    protected readonly buildId: string;
    protected readonly exampleInstanceDirectoryPath: string;
    protected readonly buildInstanceDirectoryPath: string;
    protected readonly deploymentScriptsDirectory: string;
    protected readonly logger: Logger;

    constructor(deploymentScriptsDirectory: string, buildId: string, logger: Logger) {
        this.deploymentScriptsDirectory = deploymentScriptsDirectory;
        this.buildId = buildId;
        this.logger = logger;
        this.exampleInstanceDirectoryPath = path.resolve(deploymentScriptsDirectory, 'instances', 'example');
        this.buildInstanceDirectoryPath = path.resolve(deploymentScriptsDirectory, 'instances', buildId);
    }

    replaceInFile(path: string, regex: string, replacement: string): void {
        this.replaceInFileMultiple(path, [{regex, replacement}]);
    }

    replaceInFileMultiple(path: string, replacements: { regex: string, replacement: string }[]): void {
        replacements.forEach(r => {
            replace({
                regex: r.regex,
                replacement: r.replacement,
                paths: [path],
                recursive: false,
                silent: false,
                multiline: true
            });
        });
    }

    async execDeploymentScript(name: string): Promise<void> {
        return await execDisplayOutput(path.resolve(this.deploymentScriptsDirectory, name),
            [this.buildId],
            this.deploymentScriptsDirectory,
            {
                ANSIBLE_FORCE_COLOR: "true",
                ANSIBLE_HOST_KEY_CHECKING: "false", // impossible to use Ansible with password login otherwise
                ANSIBLE_TRANSFORM_INVALID_GROUP_CHARS: "ignore", // see https://github.com/ansible/ansible/issues/56930,
                ANSIBLE_PIPELINING: "true" // see https://stackoverflow.com/questions/36646880/ansible-2-1-0-using-become-become-user-fails-to-set-permissions-on-temp-file/36681626
            });
    }

    async initInstanceDirectory(): Promise<void> {
        this.logger.log('Copying instance configuration directory...');

        await copy(this.exampleInstanceDirectoryPath, this.buildInstanceDirectoryPath);
    }
}
