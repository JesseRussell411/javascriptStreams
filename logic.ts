import { And, Or, Xor } from "./utils";

/** Logical and that doesn't short circuit. */
export function and<A extends boolean, B extends boolean>(
    a: A,
    b: B
): And<A, B>;
/** Logical and that doesn't short circuit. */
export function and(...bools: boolean[]): boolean;
export function and(...bools: boolean[]): boolean {
    if (arguments.length === 0) return false;
    for (const value of bools) if (value === false) return false;
    return true;
}

/** Logical or that doesn't short circuit. */
export function or<A extends boolean, B extends boolean>(a: A, b: B): Or<A, B>;
/** Logical or that doesn't short circuit. */
export function or(...bools: boolean[]): boolean;
export function or(...bools: boolean[]): boolean {
    if (arguments.length === 0) return false;
    for (const value of bools) if (value === true) return true;
    return false;
}

/** Logical xor. */
export function xor<A extends boolean, B extends boolean>(
    a: A,
    b: B
): Xor<A, B> {
    return a ? !b : (b as any);
}
