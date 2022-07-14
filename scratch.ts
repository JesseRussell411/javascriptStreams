import Stream, { StreamableArray } from "./Stream";
import { isArray } from "./utils";

const sa = new StreamableArray<number>(1, 2, 3, 4, 5, 6, 7);
sa.push(1);
sa.push(2);
sa.push(3);
sa.push(4);

console.log(
    sa
        .stream()
        .filter((num) => num % 2 === 0)
        .stream()
        .toArray()
);
console.log(
    JSON.stringify(
        sa
            .stream()
            .groupBy((num) => num % 2 === 0)
            .sort((g1, g2) => (g1 ? 0 : 1) - (g2 ? 0 : 1))
            .map((group) =>
                group[1].stream().map((num) => num + (group[0] ? 200 : 100))
            )
            .flat()
            .distinct()
            .toArray()
    )
);

console.log(Stream.of([1,5,1,76,3,77,2,3,767,3]).sort((a, b) => a - b).asArray());

console.log(isArray(sa));

if (isArray(sa)) {
    console.log("sa is an array");
}
