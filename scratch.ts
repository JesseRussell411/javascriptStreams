import Stream from "./Stream";
import { StreamableArray } from "./streamable";
import { testDataPromise } from "./getTestData";
import { DeLiterall, isArray, range, ValueOf } from "./utils";

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

    const pppp = Stream.empty<Stream<Stream<Set<"steve">[][]>>>()
        .flat()
        .flat()
        .flat()
        .flat()
        .flat();

    Stream.empty<number | undefined>().undefined().count();

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
            { name: "james", widgetCount: 0, id: 9 },
            20n,
            true,
            { name: "todd", id: 7, widgetCount: 1 },
            -20n,
            { foo: "fing", id: 3, widgetCount: 1 },
            false,
            ["steve", "foo", "bar"],
            3n,
            -8n,
            1n,
            { foo: "bar", id: 1, widgetCount: 6 },
            342,
            true,
            342,
            2,
            null,
            undefined,
        ])
            .order()
            .toArray()
    );
    console.log(
        Stream.of([[1, 2, 3], [1, 2], [1], [1, 2, 3, 4]])
            .orderBy(v => v.length)
            .toArray()
    );

    console.log(
        customers
            .filter(c =>
                ["MT", "OH", "WA", "FL"].includes(c.state.toUpperCase())
            )
            .map(c => ({ ...c, score: Math.trunc(Math.random() * 5) }))
            .orderBy(() => Math.random())
            .groupBy(c => c.state)
            .map(g => [
                g[0],
                g[1]
                    .stream()
                    .orderByDescending(c => c.city)
                    .thenBy(c => c.score)
                    .thenBy(c => c.first_name)
                    .thenBy(c => c.last_name)
                    .thenBy(c => c.id)
                    // .thenBy(c => c.first_name)
                    // .thenBy((a, b) => b.id - a.id)
                    .map(c => (JSON.stringify({
                        city: c.city,
                        id: c.id,
                        name: [c.first_name, c.last_name].join(" "),
                        score: c.score,
                        bad_text: c.bad_text,
                    })))
                    .toArray(),
            ])
            .toArray()
    );
}
main().catch(e => console.error(e));
