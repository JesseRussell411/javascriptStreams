import Stream from "./Stream";
import { StreamableArray } from "./streamable";
import { testDataPromise } from "./getTestData";
import { DeLiterall, isArray, ValueOf } from "./utils";

async function main() {
    const sa = new StreamableArray<number>(1, 2, 3, 4, 5, 6, 7);
    sa.push(1);
    sa.push(2);
    sa.push(3);
    sa.push(4);

    console.log(
        sa
            .stream()
            .filter(num => num % 2 === 0)
            .stream()
            .toArray()
    );
    console.log(
        JSON.stringify(
            sa
                .stream()
                .groupBy(num => num % 2 === 0)
                .sort((g1, g2) => (g1 ? 0 : 1) - (g2 ? 0 : 1))
                .map(group =>
                    group[1].stream().map(num => num + (group[0] ? 200 : 100))
                )
                .flat()
                .distinct()
                .objects()
                .toArray()
        )
    );

    const s = sa
        .stream()
        .groupBy(num => num % 2 === 0)
        .sort((g1, g2) => (g1 ? 0 : 1) - (g2 ? 0 : 1))
        .map(group =>
            group[1].stream().map(num => num + (group[0] ? 200 : 100))
        );

    console.log(
        Stream.of([1, 5, 1, 76, 3, 77, 2, 3, 767, 3])
            .sort((a, b) => a - b)
            .asArray()
    );

    console.log(isArray(sa));

    if (isArray(sa)) {
        console.log("sa is an array");
    }

    const ssss = Stream.of([
        1,
        2,
        undefined,
        4,
        undefined,
        5,
        6,
        7,
        8,
        undefined,
        null,
    ])
        .defined()
        .nonNull()
        .nonNull()
        .defined()
        .toArray();

    const sssssss = Stream.of([
        { a: "a" },
        { b: "b" },
        8,
        null,
        undefined,
    ]).undefined();

    const pppp = Stream.of<Stream<Stream<Set<"steve">[][]>>>()
        .flat()
        .flat()
        .flat()
        .flat()
        .flat();

    Stream.of<number | undefined>().undefined().count();

    const fs = Stream.of([() => 2, 4, () => 7, true, () => false]).functions();

    type test = never | number;

    const bs = Stream.of([
        () => 2,
        ,
        3,
        4,
        true,
        "hello",
        () => "world",
    ]).branch(
        stream => stream.numbers(),
        stream => stream.branch().stream()
    );

    const customers = Stream.of(await testDataPromise);

    const nums = Stream.of([
        1,
        3,
        1n,
        true,
        "string",
        { a: "asdf" },
    ] as const).branch(
        s => s.numbers().reduce((a, b) => a + b),
        s => s.bigints(),
        s => s.booleans(),
        s => s.strings(),
        s => s.objects()
    );

    console.log(
        Stream.of([
            1,
            null,
            undefined,
            8,
            true,
            [12, 2, 3, 4],
            false,
            "abc",
            "abz",
            "z",
            3,
            12,
            [],
            [1],
            [1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 3, 65, 3],
            false,
            true,
            10,
            12,
            20n,
            true,
            { foo: "bar", id: 1, widgetCount: 6 },
            { foo: "fing", id: 3, widgetCount: 1 },
            { name: "todd", id: 7, widgetCount: 1 },
            { name: "james", widgetCount: 0, id: 9 },
            -20n,
            false,
            ["steve", "foo", "bar"],
            3n,
            -8n,
            1n,
            342,
            true,
            342,
            2,
            null,
            undefined,
        ])
            .order({
                compareObjects: (a, b) => a?.widgetCount - b?.widgetCount,
                compareArrays: (a, b) => a.length - b.length,
            })
            .toArray()
    );

    console.log(
        customers
            .filter(c =>
                ["MT", "OH", "WA", "FL"].includes(c.state.toUpperCase())
            )
            .groupBy(c => c.state)
            .map(g => [
                g[0],
                g[1]
                    .stream()
                    .orderBy(c => c.first_name)
                    .map(c => c.first_name + " lives in " + c.state)
                    .toArray(),
            ])
            .toArray()
    );
}
main().catch(e => console.error(e));
