import { ok } from "assert";
import { OptionsReader, Options } from "..";
import { Logger } from "../../loggers";
import { ParameterType } from "../declaration";

const ARRAY_OPTION_TYPES = new Set<ParameterType | undefined>([
    ParameterType.Array,
    ParameterType.PathArray,
    ParameterType.ModuleArray,
    ParameterType.GlobArray,
]);

/**
 * Obtains option values from command-line arguments
 */
export class ArgumentsReader implements OptionsReader {
    readonly name = "arguments";
    readonly priority: number;
    private args: string[];

    constructor(priority: number, args = process.argv.slice(2)) {
        this.priority = priority;
        this.args = args;
    }

    read(container: Options, logger: Logger): void {
        // Make container's type more lax, we do the appropriate checks manually.
        const options = container as Options & {
            setValue(name: string, value: unknown): void;
            getValue(name: string): unknown;
        };
        const seen = new Set<string>();
        let index = 0;

        const trySet = (name: string, value: unknown) => {
            try {
                options.setValue(name, value);
            } catch (err) {
                ok(err instanceof Error);
                logger.error(err.message);
            }
        };

        while (index < this.args.length) {
            const name = this.args[index];
            const decl = name.startsWith("-")
                ? (index++, options.getDeclaration(name.replace(/^--?/, "")))
                : options.getDeclaration("entryPoints");

            if (decl) {
                if (seen.has(decl.name) && ARRAY_OPTION_TYPES.has(decl.type)) {
                    trySet(
                        decl.name,
                        (options.getValue(decl.name) as string[]).concat(
                            this.args[index]
                        )
                    );
                } else if (decl.type === ParameterType.Boolean) {
                    const value = String(this.args[index]).toLowerCase();

                    if (value === "true" || value === "false") {
                        trySet(decl.name, value === "true");
                    } else {
                        trySet(decl.name, true);
                        // Bool option didn't consume the next argument as expected.
                        index--;
                    }
                } else {
                    if (index === this.args.length) {
                        // Only boolean values have optional values.
                        logger.warn(
                            `--${decl.name} expected a value, but none was given as an argument`
                        );
                    }
                    trySet(decl.name, this.args[index]);
                }
                seen.add(decl.name);
            } else {
                logger.error(`Unknown option: ${name}`);
            }

            index++;
        }
    }
}
