export function and(first: boolean, ...rest: boolean[]): boolean;
export function and(...values: boolean[]): boolean {
    for (const value of values) if (value === false) return false;
    return arguments.length > 0;
}

export function or(first: boolean, ...rest: boolean[]): boolean;
export function or(...values: boolean[]): boolean {
    for (const value of values) if (value === true) return true;
    return false;
}

export function xor(a: boolean, b: boolean): boolean {
    return a ? !b : b;
}
