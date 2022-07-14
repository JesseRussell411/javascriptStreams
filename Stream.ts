import {
    lazy,
    iter,
    partialCopy,
    asArray,
    asSet,
    includes,
    join,
    isIterable,
    breakSignal,
    numberComparator,
    setAndGet,
    isArray,
    last,
} from "./utils";
import { isIterationStatement } from "typescript";
import Streamable from "./Streamable";

export class StreamableArray<T> extends Array<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.of(this);
    }
}

export class StreamableSet<T> extends Set<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.of(this);
    }
}

export class StreamableMap<K, V>
    extends Map<K, V>
    implements Streamable<[K, V]>
{
    public stream(): Stream<[K, V]> {
        return Stream.of(this);
    }
}

export default class Stream<T> implements Iterable<T>, Streamable<T> {
    private getSource: () => Iterable<T>;

    private constructor(getSource: () => Iterable<T>) {
        this.getSource = getSource;
    }

    public static of<T>(source?: Iterable<T>) {
        return new Stream(() => source ?? []);
    }

    public static from<T>(sourceGetter: () => Iterable<T>) {
        return new Stream(sourceGetter);
    }

    public static iter<T>(generatorGetter: () => Generator<T>) {
        return new Stream(() => iter(generatorGetter));
    }

    public [Symbol.iterator]() {
        return this.getSource()[Symbol.iterator]();
    }

    public forEach(
        callback: (value: T, index: number, stream: this) => Symbol | void
    ): this {
        let index = 0;
        for (const value of this) {
            if (callback(value, index++, this) === breakSignal) break;
        }

        return this;
    }

    public map<R>(
        mapping: (value: T, index: number, stream: this) => R
    ): Stream<R> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) yield mapping(value, index++, self);
        });
    }

    public filter(
        filter: (value: T, index: number, stream: this) => boolean
    ): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self)
                if (filter(value, index, self)) yield value;
        });
    }

    public groupBy<K>(
        keySelector: (value: T, index: number, stream: this) => K
    ): Stream<[K, Streamable<T> & T[]]> {
        return Stream.from(() => {
            const groups = new Map<K, StreamableArray<T>>();
            let index = 0;
            for (const value of this) {
                const key = keySelector(value, index++, this);
                const group =
                    groups.get(key) ??
                    setAndGet(groups, key, new StreamableArray());
                group.push(value);
            }
            return Stream.of(groups);
        });
    }

    public sort(comparator?: (a: T, b: T) => number): Stream<T> {
        return Stream.from(() => {
            const sorted = this.toArray();
            sorted.sort(comparator);
            return sorted;
        });
    }

    public reverse(): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const array = self.asArray();
            for (let i = array.length - 1; i >= 0; i--) yield array[i];
        });
    }

    public takeWhile(test: (value: T, index: number, stream: this) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) {
                if (!test(value, index++, self)) break;
                yield value;
            }
        });
    }

    public skipWhile(test: (value: T, index: number, stream: this) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) if (test(value, index++, self)) break;
            for (const value of self) yield value;
        });
    }

    public take(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().take(-count).reverse();
        return this.takeWhile((_, index) => index < usableCount);
    }

    public skip(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().skip(-count).reverse();
        return this.skipWhile((_, index) => index < usableCount);
    }

    public concat<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of self) yield value;
            for (const value of other) yield value;
        });
    }

    public unShift<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of other) yield value;
            for (const value of self) yield value;
        });
    }

    public distinct(
        identifier: (value: T) => any = (value) => value
    ): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const returned = new Set<any>();
            for (const value of self) {
                const id = identifier(value);
                if (returned.has(id)) continue;
                yield value;
                returned.add(id);
            }
        });
    }

    public toArray(): T[] {
        return [...this];
    }

    public toSet(): Set<T> {
        return new Set(this);
    }

    public stream(): Stream<T> {
        return Stream.of(this.toArray());
    }

    public asArray(): readonly T[] {
        return asArray(this.getSource());
    }

    public asSet(): ReadonlySet<T> {
        return asSet(this.getSource());
    }

    public toMap<K, V>(
        keySelector: (value: T, index: number, stream: this) => K,
        valueSelector: (value: T, index: number, stream: this) => V
    ): Map<K, V> {
        const map = new Map<K, V>();

        let index = 0;
        for (const value of this) {
            map.set(
                keySelector(value, index, this),
                valueSelector(value, index, this)
            );
            index++;
        }

        return map;
    }

    public reduce<R>(
        reduction: (
            previousResult: R,
            current: T,
            index: number,
            stream: this
        ) => R,
        initialValue: R
    ): R;

    public reduce(
        reduction: (
            previousResult: T,
            current: T,
            index: number,
            stream: this
        ) => T
    ): T | undefined;

    public reduce(
        reduction: (
            previousResult: any,
            current: T,
            index: number,
            stream: this
        ) => any,
        initialValue?: any
    ): any {
        const iterator = this[Symbol.iterator]();
        let next;
        let result;
        let index: number;

        if (arguments.length > 1) {
            result = initialValue;
            index = 0;
        } else {
            next = iterator.next();
            if (next.done) return undefined;
            result = next.value;
            index = 1;
        }

        while (!(next = iterator.next()).done) {
            result = reduction(result, next.value, index, this);
        }

        return result;
    }

    public includes(value: T): boolean {
        return includes(this.getSource(), value);
    }

    public some(
        test: (value: T, index: number, stream: this) => boolean = () => true
    ) {
        let index = 0;
        for (const value of this) if (test(value, index++, this)) return true;
        return false;
    }

    public none(
        test: (value: T, index: number, stream: this) => boolean = () => true
    ) {
        return !this.some(test);
    }

    public every(test: (value: T, index: number, stream: this) => boolean) {
        let index = 0;
        for (const value of this) if (!test(value, index++, this)) return false;
        return true;
    }

    public join(separator: string = ""): string {
        return join(this, separator);
    }

    public flat(): T extends Iterable<infer subT>
        ? Stream<T | subT>
        : Stream<unknown> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of self) {
                if (isIterable(value))
                    for (const subValue of value) yield subValue;
                else yield value;
            }
        }) as any;
    }

    public find(
        test: (value: T, index: number, stream: this) => boolean
    ): T | undefined {
        let index = 0;
        for (const value of this) if (test(value, index++, this)) return value;
        return undefined;
    }

    public first(): T | undefined{
        for(const value of this) return value;
        return undefined;
    }

    public last(): T | undefined{
        return last(this.getSource());
    }
}
