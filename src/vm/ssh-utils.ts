import {execDisplayOutput} from "../exec-utils";
import * as path from "path";

export async function ssh_keygen(destDir: string, file: string) {
    await execDisplayOutput("ssh-keygen", ["-t", "rsa", "-b", "4096", "-f", path.resolve(destDir, file), "-N", ""]);
    await execDisplayOutput("chmod", ["600", path.resolve(destDir, file)]);
    await execDisplayOutput("chmod", ["644", `${path.resolve(destDir, file)}.pub`]);
}
