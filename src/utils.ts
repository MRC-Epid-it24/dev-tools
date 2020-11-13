import * as fs from 'fs';
import * as path from 'path';
import Chalk = require('chalk');
import Vorpal = require('vorpal');

export function makeTimeStamp(): string {
    let date = new Date();
    return `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getFullYear().toString().substring(2)}`;
}

export async function getMostRecentFile(dirPath: string, filter: (name: string) => boolean): Promise<string | undefined> {
    let files = await fs.promises.readdir(dirPath);
    let filtered = files.filter(filter);

    if (filtered.length < 1) {
        return undefined;
    } else {
        let mostRecentPath = path.join(dirPath, filtered[0]);
        let mostRecentTime = (await fs.promises.stat(mostRecentPath)).ctimeMs;

        for (let file of filtered.slice(1)) {
            let p = path.join(dirPath, file);
            let stats = await fs.promises.stat(p);

            if (stats.ctimeMs > mostRecentTime) {
                mostRecentPath = p;
                mostRecentTime = stats.ctimeMs;
            }
        }

        return mostRecentPath;
    }
}

export interface Logger {
    highlight(str: string): string;

    warning(str: string): string;

    bold(str: string): string;

    log(message: string): void;
}

export class VorpalLogger implements Logger {
    private readonly vorpal: Vorpal;

    constructor(vorpal: Vorpal) {
        this.vorpal = vorpal;
    }

    highlight(str: string): string {
        return Chalk.blueBright(str);
    }

    warning(str: string): string {
        return Chalk.whiteBright(Chalk.bgRed(str));
    }


    log(message: string): void {
        if (this.vorpal.activeCommand)
            this.vorpal.activeCommand.log(message);
        else
            this.vorpal.log(message);
    }

    bold(str: string): string {
        return Chalk.whiteBright(Chalk.bold(str));
    }
}
