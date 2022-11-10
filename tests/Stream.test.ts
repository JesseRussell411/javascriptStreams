import Stream from "../Stream";
import { getCustomers } from "../testData/customers";
import { getProducts } from "../testData/products";
import { getPurchases } from "../testData/purchases";

describe("sequenceEqual", () => {
    test("of empty streams", () => {
        expect(Stream.empty().sequenceEqual(Stream.of())).toBe(true);
    });
    test("of non equal streams", () => {
        expect(Stream.of(1, 2, 3).sequenceEqual(Stream.of(3, 2, 1))).toBe(
            false
        );
        expect(Stream.of(1, 2, 3).sequenceEqual(Stream.of(1, 2, 3, 4))).toBe(
            false
        );
        expect(Stream.of(1, 2, 3, 4).sequenceEqual(Stream.of(1, 2, 3))).toBe(
            false
        );
        expect(Stream.of("1", "2", "3").sequenceEqual(Stream.of(1, 2, 3))).toBe(
            false
        );
    });
    test("of equal streams", () => {
        expect(
            Stream.of(1, 2, 3, 4, 5).sequenceEqual(Stream.of(1, 2, 3, 4, 5))
        ).toBe(true);
    });
});

describe("map", () => {
    test("numbers", () => {
        expect(
            Stream.of(1, 2, 3, 4, 5, 6)
                .map(n => n / 2)
                .sequenceEqual([0.5, 1, 1.5, 2, 2.5, 3])
        ).toBe(true);
    });
});

describe("filter", () => {
    test("numbers", () => {
        expect(
            Stream.of(1, 2, 3, 4, 5, 8, 20, 21, 20)
                .filter(n => n % 2 == 0)
                .sequenceEqual([2, 4, 8, 20, 20])
        ).toBe(true);
    });
});

describe("reduce", () => {
    describe("of empty", () => {
        test("with initial value", () => {
            expect(Stream.empty<number>().reduce((p, c) => p + c, -1)).toBe(-1);
        });
        test("without initial value throws error", () => {
            try {
                Stream.empty<number>().reduce((p, c) => p + c);
            } catch (e) {
                expect(e instanceof Error).toBe(true);
            }
        });
    });
    describe("of non empty", () => {
        test("with initial value", () => {
            expect(Stream.of(1, 2, 3, 4, 5).reduce((p, c) => p + c, -1)).toBe(
                14
            );
        });
        test("without initial value", () => {
            expect(Stream.of(1, 2, 3, 4, 5).reduce((p, c) => p + c)).toBe(15);
        });
    });
});

test("map to select name", async () => {
    const customers = await getCustomers();
    customers
        .map(c => c.first_name)
        .forEach(n => expect(typeof n).toBe("string"));
});

// TODO LOTS MORE TESTS TO WRITE!
