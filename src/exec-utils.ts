import {spawn} from 'child_process';

export interface ExecResult {
    stdout: string;
    stderr: string;
}

async function execImpl(command: string, args: ReadonlyArray<string>,
                        onStdout: (data: string) => void, onStderr: (data: string) => void,
                        workingDirectory?: string, envVars?: { [key: string]: string }): Promise<void> {
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
            onStdout(data);
        });
        child.stderr.on('data', function (data) {
            onStderr(data);
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

export async function execDisplayOutput(command: string, args: ReadonlyArray<string>, workingDirectory?: string,
                                        envVars?: { [key: string]: string }): Promise<void> {

    return await execImpl(command, args,
        (data) => process.stdout.write(data),
        (data) => process.stderr.write(data),
        workingDirectory,
        envVars);
}

export async function execCollectOutput(command: string, args: ReadonlyArray<string>, workingDirectory?: string,
                                        envVars?: { [key: string]: string }): Promise<ExecResult> {

    let out = '';
    let err = '';

    await execImpl(command, args,
        (data) => {
            out += data;
        },
        (data) => {
            err += data;
            process.stderr.write(data);
        },
        workingDirectory,
        envVars);

    return {stdout: out, stderr: err};
}
