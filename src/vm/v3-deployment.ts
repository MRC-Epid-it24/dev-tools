import * as path from 'path';
import * as fs from 'fs';
import {copy} from 'fs-extra';
// @ts-ignore
import replace from 'replace';
import {ssh_keygen} from './ssh-utils';

import {V3OfflineSettings} from './v3-offline-settings';

import {
    foodDatabaseFileName,
    imageDatabaseFileName,
    systemDatabaseDataFileName,
    systemDatabaseFileName,
    systemDatabaseSchemaFileName
} from './constants';
import {execDisplayOutput} from '../exec-utils';
import {Logger} from '../utils';
import {DeploymentUtils} from './deployment-utils';

export class V3Deployment extends DeploymentUtils {
    private readonly settings: V3OfflineSettings;

    constructor(settings: V3OfflineSettings, buildId: string, logger: Logger) {
        super(settings.deployment.directory, buildId, logger);
        this.settings = settings;
    }

    async createDeployUser(): Promise<void> {
        this.logger.log('Creating deploy user...');

        this.replaceInFile(path.resolve(this.buildInstanceDirectoryPath, 'hosts'), 'host\\.name\\.tld', this.settings.virtualBox.ip4address);

        await fs.promises.rename(path.resolve(this.buildInstanceDirectoryPath, 'host_vars', 'host.example.tld.bootstrap'),
            path.resolve(this.buildInstanceDirectoryPath, 'host_vars', this.settings.virtualBox.ip4address));

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'host_vars', this.settings.virtualBox.ip4address), [
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

        await this.execDeploymentScript('create-deploy-user.sh');
    }

    async switchToDeployUser(): Promise<void> {
        this.logger.log('Configuring host_vars to use deploy user instead of bootstrap...');

        try {
            await fs.promises.unlink(path.resolve(this.buildInstanceDirectoryPath, 'host_vars', this.settings.virtualBox.ip4address));
        } catch {
            // FIXME: need to check for ENOENT and rethrow other errors
        }

        await fs.promises.rename(path.resolve(this.buildInstanceDirectoryPath, 'host_vars', 'host.example.tld'),
            path.resolve(this.buildInstanceDirectoryPath, 'host_vars', this.settings.virtualBox.ip4address));
    }

    async configureNginx(): Promise<void> {
        this.logger.log('Configuring nginx...');

        return this.execDeploymentScript('configure-nginx.sh');
    }

    async configureJava(): Promise<void> {
        this.logger.log('Configuring Java...');

        return this.execDeploymentScript('configure-java.sh');
    }

    async createDatabases(homeDirectoryPath: string): Promise<void> {
        this.logger.log('Creating databases...');

        await execDisplayOutput('unzip', ['-o', systemDatabaseFileName], homeDirectoryPath);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'database', 'postgres-configuration.yml'), [
            {
                regex: 'schema_snapshot_path:.*$',
                replacement: `schema_snapshot_path: ${path.resolve(homeDirectoryPath, systemDatabaseSchemaFileName)}`
            },
            {
                regex: 'data_snapshot_path:.*$',
                replacement: `data_snapshot_path: ${path.resolve(homeDirectoryPath, systemDatabaseDataFileName)}`
            },
            {
                regex: '(^\\s+snapshot_path):.*$',
                replacement: `$1: ${path.resolve(homeDirectoryPath, foodDatabaseFileName)}`
            },
            {
                regex: 'admin_user_email:.*$',
                replacement: 'admin_user_email: admin@localhost'
            }
        ]);

        await this.execDeploymentScript('create-databases.sh');
    }

    async copyImages(homeDirectoryPath: string): Promise<void> {
        this.logger.log('Copying image database, this will take a while...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'image-database', 'settings.json'), [
            {
                regex: '"image_database_archive": "/path/to/images.zip"',
                replacement: `"image_database_archive": "${path.resolve(homeDirectoryPath, imageDatabaseFileName)}"`
            }
        ]);

        await this.execDeploymentScript('copy-image-database.sh');
    }

    async installApiServer(): Promise<void> {
        this.logger.log('Installing API server...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'api-server', 'application.conf'), [
            {
                regex: 'play\\.modules\\.enabled \\+= "modules.S3StorageReadOnlyModule"',
                replacement: '# play.modules.enabled += "modules.S3StorageReadOnlyModule"'
            },
            {
                regex: '#play\\.modules\\.enabled \\+= "modules.LocalStorageModule"',
                replacement: 'play.modules.enabled += "modules.LocalStorageModule"'
            },
            {
                regex: '^(  adminFrontendUrl =).*$',
                replacement: `$1 "http://${this.settings.virtualBox.ip4address}:${this.settings.admin.port}"`
            },
            {
                regex: '^(  surveyFrontendUrl =).*$',
                replacement: `$1 "http://${this.settings.virtualBox.ip4address}:${this.settings.frontend.port}"`,
            },
            {
                regex: '      baseDirectory = "/path/to/intake24-images/"',
                replacement: '      baseDirectory = "/var/opt/intake24/images"'
            },
            {
                regex: '      urlPrefix = "http://192\\.168\\.1\\.1:8001/images"',
                replacement: `      urlPrefix = "http://${this.settings.virtualBox.ip4address}:${this.settings.apiServer.port}/images"`

            }
        ]);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'api-server', 'play-app.json'), [
            {
                regex: '    "debian_package_path" :.*$',
                replacement: `    "debian_package_path" : "${this.settings.apiServer.v1debianPackagePath}",`
            },
            {
                regex: '    "java_memory_max": "512m"',
                replacement: '    "java_memory_max": "2048m"'
            }
        ]);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'play-shared', 'http-secret.conf'), [
            {
                regex: 'play.http.secret.key=.*$',
                replacement: `play.http.secret.key="${this.settings.apiServer.playSecret}"`
            },
        ]);

        await this.execDeploymentScript('api-server.sh');

        this.logger.log('Installing API V2 server...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'api-server-v2', 'settings.json'), [
            {
                regex: '"source_jar_path": ""',
                replacement: `"source_jar_path": "${this.settings.apiServer.v2jarPath}"`
            },
            {
                regex: '"java_memory_max": "128m"',
                replacement: '"java_memory_max": "256m"'
            }
        ]);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'api-server-v2', 'service.conf'), [
            {
                regex: 'url = "jdbc:postgresql://192.168.56.2:5432/intake24_system"',
                replacement: `url = "jdbc:postgresql://localhost:5432/intake24_system"`
            },
            {
                regex: 'url = "jdbc:postgresql://192.168.56.2:5432/intake24_foods"',
                replacement: 'url = "jdbc:postgresql://localhost:5432/intake24_foods'
            },
            {
                regex: 'jwtSecret = ""',
                replacement: `jwtSecret = "${this.settings.apiServer.playSecret}"`
            },
            {
                regex: 'downloadURLPrefix = "http://localhost:6403/files"',
                replacement: `downloadURLPrefix = "http://${this.settings.virtualBox.ip4address}:${this.settings.apiServer.port}/v2/files"`
            }
        ]);

        await this.execDeploymentScript('api-server-v2.sh');

        this.logger.log('Installing data export service...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'data-export-service', 'application.conf'), [
            {
                regex: '^(  apiServerUrl =).*$',
                replacement: `$1 "http://${this.settings.virtualBox.ip4address}:${this.settings.apiServer.port}"`
            },
            {
                regex: '^(  surveyFrontendUrl =).*$',
                replacement: `$1 "http://${this.settings.virtualBox.ip4address}:${this.settings.frontend.port}"`,
            }
        ]);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'data-export-service', 'play-app.json'), [
            {
                regex: '    "debian_package_path" :.*$',
                replacement: `    "debian_package_path" : "${this.settings.apiServer.dataExportServiceDebianPackagePath}",`
            }
        ]);

        await this.execDeploymentScript('data-export-service.sh');


        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'api-server', 'nginx-site'), [
            {
                regex: '  listen 8001',
                replacement: `  listen ${this.settings.apiServer.port}`
            },
            {
                regex: '  listen \\[::\\]:8001',
                replacement: `  listen [::]:${this.settings.apiServer.port}`
            },
            {
                regex: '  server_name 192\\.168\\.1\\.1',
                replacement: `  server_name ${this.settings.virtualBox.ip4address}`
            },
            {
                regex: '    alias /path/to/intake24-images/',
                replacement: '    alias /var/opt/intake24/images/'
            }
        ]);

        await this.execDeploymentScript('nginx-api-server.sh');

    }

    async installRespondentFrontend(): Promise<void> {
        this.logger.log('Installing respondent frontend...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'survey-site', 'application.conf'), [
            {
                regex: '^(  externalApiBaseUrl =).*$',
                replacement: `$1 "http://${this.settings.virtualBox.ip4address}:${this.settings.apiServer.port}"`,
            }
        ]);

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'survey-site', 'play-app.json'), [
            {
                regex: '    "debian_package_path" :.*$',
                replacement: `    "debian_package_path" : "${this.settings.frontend.debianPackagePath}",`
            },
            {
                regex: '"http_port": "8000"',
                replacement: `"http_port": "${this.settings.frontend.port}"`,
            }
        ]);

        await this.execDeploymentScript('survey-site.sh');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'survey-site', 'nginx-site'), [
            {
                regex: '  listen 8000',
                replacement: `  listen ${this.settings.frontend.port}`
            },
            {
                regex: '  listen \\[::\\]:8000',
                replacement: `  listen [::]:${this.settings.frontend.port}`
            },
            {
                regex: '  server_name 192\\.168\\.1\\.1',
                replacement: `  server_name ${this.settings.virtualBox.ip4address}`
            },
            {
                regex: '    alias /path/to/intake24-images/',
                replacement: '    alias /var/opt/intake24/images'
            }
        ]);

        await this.execDeploymentScript('nginx-survey-site.sh');
    }

    async installAdminFrontend(): Promise<void> {
        this.logger.log('Installing admin frontend...');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'admin-site', 'app.json'), [
            {
                regex: '"api_base_url": "http://192.168.1.1:8001/"',
                replacement: `"api_base_url": "http://${this.settings.virtualBox.ip4address}:${this.settings.apiServer.port}/"`
            },
            {
                regex: '"http_port": "8000"',
                replacement: `"http_port": "${this.settings.frontend.port}"`,
            }
        ]);

        this.execDeploymentScript('admin-site.sh');

        this.replaceInFileMultiple(path.resolve(this.buildInstanceDirectoryPath, 'admin-site', 'nginx-site'), [
            {
                regex: '  listen 80',
                replacement: `  listen ${this.settings.admin.port}`
            },
            {
                regex: '  listen \\[::\\]:80',
                replacement: `  listen [::]:${this.settings.admin.port}`
            },
            {
                regex: '  server_name 192\\.168\\.1\\.1',
                replacement: `  server_name ${this.settings.virtualBox.ip4address}`
            }
        ]);

        this.execDeploymentScript('nginx-admin-site.sh');
    }
}
