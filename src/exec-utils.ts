import {spawn} from 'child_process';

export interface ExecResult {
    stdout: string;
    stderr: string;
}

export async function execDisplayOutput(command: string, args: ReadonlyArray<string>, workingDirectory?: string,
                                        envVars?: { [key: string] : string}): Promise<void> {
    return new Promise((resolve, reject) => {

        let env = {...process.env};

        if (envVars) {
            for (let k in envVars) {
                env[k] = envVars[k];
            }
        }

        let child = spawn(command, args, {cwd: workingDirectory, env: env});
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', function (data) {
            process.stdout.write(data);
        });
        child.stderr.on('data', function (data) {
            process.stderr.write(data);
        });
        child.on('close', function (code: number) {
            if (code == 0) {
                resolve();
            } else {
                reject('Process "' + command + '" failed with code ' + code);
            }
        });
        child.on('error', function (error) {
            reject(error);
        })
    });
}
