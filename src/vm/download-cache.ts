import * as fs from 'fs';
import {PathLike} from 'fs';

import * as https from 'https';
import {Logger} from '../utils';

const sha256File = require('sha256-file');


export class DownloadCache {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;

    }

    async sha256sum(path: PathLike): Promise<string> {
        return new Promise((resolve, reject) => {
            sha256File(path, (error: any, sum: string) => {
                if (error)
                    reject(error);
                else
                    resolve(sum);
            });
        });
    }

    async download(url: string, dest: string): Promise<void> {
        this.logger.log(`Downloading ${this.logger.highlight(url)}, this might take a while...`);

        let file = fs.createWriteStream(dest);

        return new Promise((resolve, reject) => {
            https.get(url, function (response) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                });
                file.on('close', () => {
                    resolve();
                });
            });
        });
    }


    async checkCachedFile(path: string, checksum: string, skipIntegrityCheck: boolean): Promise<boolean> {
        try {
            let stats = await fs.promises.stat(path);

            if (skipIntegrityCheck) {
                this.logger.log(`Found cached ${this.logger.highlight(path)}, skipping integrity check`);
                return Promise.resolve(true);
            } else {
                this.logger.log(`Found cached ${this.logger.highlight(path)}, verifying checksum...`);
                let sum = await this.sha256sum(path);

                if (sum == checksum) {
                    this.logger.log('Checksum OK');
                    return Promise.resolve(true);
                } else {
                    this.logger.log(`Cached file checksum doesn't match, removing file`);
                    await fs.promises.unlink(path);
                    return Promise.resolve(false);
                }
            }
        } catch (err) {
            return Promise.resolve(false);
        }
    }

    async ensureFileExists(cachedFilePath: string, checksum: string, downloadUrl: string, skipIntegrityCheck: boolean): Promise<void> {

        let cacheOk = await this.checkCachedFile(cachedFilePath, checksum, skipIntegrityCheck);

        if (cacheOk) {
            return Promise.resolve();
        } else {
            await this.download(downloadUrl, cachedFilePath);
            this.logger.log('Verifying the integrity of downloaded file...');
            let actualChecksum = await this.sha256sum(cachedFilePath);
            if (actualChecksum == checksum) {
                this.logger.log('Checksum OK');
                return Promise.resolve();
            } else {
                fs.unlinkSync(cachedFilePath);
                return Promise.reject('Checksum mismatch for downloaded file, expected ' + checksum + ', got ' + actualChecksum);
            }
        }
    }
}
