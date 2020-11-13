import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {Constants} from './constants';

export async function ensureDirectoryExists(path: string) {
    try {
        let stats = await fs.promises.stat(path);
        if (!stats.isDirectory())
            throw new Error(path + ' exists but is not a directory');
        return {
            path: path,
            created: false
        }
    } catch (e) {
        return fs.promises.mkdir(path, {recursive: true}).then(() => {
            return {
                path: path,
                created: true
            }
        });
    }
}


export async function ensureHomeDirectoryExists(homeDirectoryOverride?: string): Promise<{ path: string, created: boolean }> {
    const homeDirectoryPath = (homeDirectoryOverride) ?
        path.resolve(homeDirectoryOverride, Constants.homeDirectoryName) : path.resolve(os.homedir(), Constants.homeDirectoryName);

    return await ensureDirectoryExists(homeDirectoryPath);
}
