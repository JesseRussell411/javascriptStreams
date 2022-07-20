export function and(): undefined;
export function and(first: boolean, ...rest: boolean[]): boolean;
export function and(...bools: boolean[]): boolean | undefined;
export function and(...values: boolean[]): boolean | undefined {
    if (arguments.length === 0) return undefined;
    for (const value of values) if (value === false) return false;
    return true;
}

export function or(): undefined;
export function or(first: boolean, ...rest: boolean[]): boolean;
export function or(...bools: boolean[]): boolean | undefined;
export function or(...values: boolean[]): boolean | undefined {
    if (arguments.length === 0) return undefined;
    for (const value of values) if (value === true) return true;
    return false;
}

export function xor(a: boolean, b: boolean): boolean {
    return a ? !b : b;
}
