import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import {ssh_keygen} from './ssh-utils';
import {Logger} from '../utils';
import {V4DevSettings} from './v4-dev-settings';
import {DeploymentUtils} from './deployment-utils';
import {getV4AnsiblePostgresConfiguration} from './v4-postgres-config';

export class V4Deployment extends DeploymentUtils {
    private readonly settings: V4DevSettings;

    private static readonly redisAllowAllConfig =
        `{
           "redis": {
            "protectedMode": "no"
           }
         }
         `;

    constructor(settings: V4DevSettings, buildId: string, logger: Logger) {
        super(settings.deployment.directory, buildId, logger);

        this.settings = settings;
    }

    async createDeployUser(): Promise<void> {
        this.logger.log(this.logger.bold('\nCreating deploy user...'));

        this.replaceInFile(path.resolve(this.buildInstanceDirectoryPath, 'hosts'), 'localhost', this.settings.virtualBox.ip4address);

        await fs.promises.rename(path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all'),
            path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all.default'));

        await fs.promises.rename(path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all.bootstrap'),
            path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all'));

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all'), [
            {
                regex: 'ansible_user:.*$',
                replacement: 'ansible_user: intake24',
            },
            {
                regex: 'ansible_password:.*$',
                replacement: 'ansible_password: intake24',
            },
            {
                regex: 'ansible_become_pass:.*$',
                replacement: 'ansible_become_pass: intake24',
            }
        ]);

        await ssh_keygen(path.resolve(this.buildInstanceDirectoryPath, 'ssh'), 'deploy');

        await this.execDeploymentScript('deploy-user.sh');

        try {
            await fs.promises.unlink(path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all'));
        } catch {
            // FIXME: need to check for ENOENT and rethrow other errors
        }

        await fs.promises.rename(path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all.default'),
            path.resolve(this.buildInstanceDirectoryPath, 'group_vars', 'all'));

    }

    async createDatabases(): Promise<void> {
        this.logger.log(this.logger.bold('\nCreating databases...'));

        await fs.promises.writeFile(path.resolve(this.buildInstanceDirectoryPath, 'postgres', 'postgres-configuration.yml'),
            getV4AnsiblePostgresConfiguration(
                this.settings.databases.systemSchemaSnapshot,
                this.settings.databases.systemDataSnapshot,
                this.settings.databases.foodsSnapshot));

        await this.execDeploymentScript('database-init.sh');
    }

    async installRedis(): Promise<void> {
        this.logger.log(this.logger.bold('\nInstalling redis...'));

        await fs.promises.writeFile(path.resolve(this.buildInstanceDirectoryPath, 'redis', 'redis-config.json'),
            V4Deployment.redisAllowAllConfig);

        await this.execDeploymentScript('redis.sh');
    }
}
