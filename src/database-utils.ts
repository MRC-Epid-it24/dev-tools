import {DatabaseConnectionParameters, DatabaseProfile} from './databases';
import {execCollectOutput, execDisplayOutput, ExecResult} from './exec-utils';
import {Settings} from './settings';

export async function runPsqlCommand(settings: Settings, connection: DatabaseConnectionParameters, additionalArguments: string[], command: string, runAsSuperuser: boolean): Promise<ExecResult> {
    let user = runAsSuperuser ? connection.superuser : connection.user;

    if (!user)
        throw new Error('This operation requires superuser access and superuser settings are missing from the database profile');

    let password = runAsSuperuser ? connection.superuserPassword : connection.password;
    let envVars = password ? {PGPASSWORD: password} : undefined;

    let args = additionalArguments.concat([
        '-h', connection.host,
        '-U', user,
        '-c', command,
        runAsSuperuser ? 'postgres' : connection.database]);

    return await execCollectOutput(settings.psqlCommand, args, undefined, envVars);
}

export async function databaseExists(settings: Settings, connection: DatabaseConnectionParameters): Promise<boolean> {
    let output = await runPsqlCommand(
        settings,
        connection,
        ['-tA'],
        `SELECT 1 FROM pg_database WHERE datname='${connection.database}'`,
        true);

    return output.stdout.trim() === '1';
}

export async function dropDatabase(settings: Settings, connection: DatabaseConnectionParameters): Promise<void> {

    let preventConnections = `
        -- Disallow new connections
        UPDATE pg_database SET datallowconn = 'false' WHERE datname = '${connection.database}';
        ALTER DATABASE intake24_foods CONNECTION LIMIT 1;

        -- Terminate existing connections
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${connection.database}';`;

    await runPsqlCommand(
        settings,
        connection,
        [],
        preventConnections,
        true);

    await runPsqlCommand(
        settings,
        connection,
        [],
        `DROP DATABASE ${connection.database}`,
        true);

}

export async function createDatabase(settings: Settings, connection: DatabaseConnectionParameters): Promise<void> {
    await runPsqlCommand(
        settings,
        connection,
        [],
        `CREATE DATABASE ${connection.database} OWNER ${connection.user}`,
        true);
}
