/** Logical and that doesn't short circut. */
export function and(): undefined;
/** Logical and that doesn't short circut. */
export function and(first: boolean, ...rest: boolean[]): boolean;
/** Logical and that doesn't short circut. */
export function and(...bools: boolean[]): boolean | undefined;
export function and(...values: boolean[]): boolean | undefined {
    if (arguments.length === 0) return undefined;
    for (const value of values) if (value === false) return false;
    return true;
}

/** Logical or that doesn't short circut. */
export function or(): undefined;
/** Logical or that doesn't short circut. */
export function or(first: boolean, ...rest: boolean[]): boolean;
/** Logical or that doesn't short circut. */
export function or(...bools: boolean[]): boolean | undefined;
export function or(...values: boolean[]): boolean | undefined {
    if (arguments.length === 0) return undefined;
    for (const value of values) if (value === true) return true;
    return false;
}

/** Logical xor. */
export function xor(a: boolean, b: boolean): boolean {
    return a ? !b : b;
}
