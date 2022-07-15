import { iter } from "./utils";

export function split<T>(iterator: Iterator<T>) {
    const cache: T[] = [];
    return iter(function*(){
        let j = 0;

        while (true) {
            if (j < cache.length) {
                yield cache[j];
            } else {
                const next = iterator.next();
                if (next.done) break;

                cache.push(next.value);
                yield next.value;
            }
            j++;
        }
    });
}
