import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {Constants} from "./constants";


export async function ensureHomeDirectoryExists(homeDirectoryOverride?: string): Promise<{ path: string, created: boolean }> {
    const homeDirectoryPath = (homeDirectoryOverride) ?
        path.resolve(homeDirectoryOverride, Constants.homeDirectoryName) : path.resolve(os.homedir(), Constants.homeDirectoryName);

    try {
        let stats = await fs.promises.stat(homeDirectoryPath);
        if (!stats.isDirectory())
            throw new Error(homeDirectoryPath + " exists but is not a directory");
        return {
            path: homeDirectoryPath,
            created: false
        }
    } catch (e) {
        return fs.promises.mkdir(homeDirectoryPath, {recursive: true}).then(() => {
            return {
                path: homeDirectoryPath,
                created: true
            }
        });
    }
}
