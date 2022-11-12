import Stream from "../Stream";
import { getCustomers } from "../testData/customers";
import { getProducts } from "../testData/products";
import { getPurchases } from "../testData/purchases";
import { deepCopy, deepEquals } from "../utils";

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

describe("mkString", () => {
    test("no params", () => {
        expect(Stream.of(1, 2, 3, 4).mkString()).toBe("1234");
    });
    test("just separator", () => {
        expect(Stream.of(1, 2, 3, 4).mkString(",")).toBe("1,2,3,4");
    });
    test("start and separator", () => {
        expect(Stream.of(1, 2, 3, 4).mkString("[", ",")).toBe("[1,2,3,4");
    });
    test("start and separator and end", () => {
        expect(Stream.of(1, 2, 3, 4).mkString("[", ",", "]")).toBe("[1,2,3,4]");
    });
});

describe("deepEquals", () => {
    test("returns true", () => {
        expect(deepEquals({}, {})).toBe(true);
        expect(deepEquals({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    });
    test("returns false", () => {
        expect(deepEquals({}, [])).toBe(false);
        expect(deepEquals({ a: [1, 2] }, { a: [1, 23] })).toBe(false);
    });
});

describe("deepCopy", () => {
    test("", () => {
        expect(
            deepEquals(
                deepCopy({
                    a: "foo",
                    b: [1, 2, 3, ["a", { foo: "bar", n: 42 }, "b"]],
                }),
                {
                    a: "foo",
                    b: [1, 2, 3, ["a", { foo: "bar", n: 42 }, "b"]],
                }
            )
        );
    });
});

describe("integration tests", () => {
    test("map to select name", async () => {
        const customers = await getCustomers();
        customers
            .map(c => c.first_name)
            .forEach(n => expect(typeof n).toBe("string"));
    });

    test("group customers to products through purchases", async () => {
        const [customerData, productData, purchaseData] = await Promise.all([
            getCustomers(),
            getProducts(),
            getPurchases(),
        ]);

        const customers = customerData
            .groupJoin(
                productData
                    .join(
                        purchaseData,
                        product => product.id,
                        purchase => purchase.productID,
                        (product, purchase) => ({ purchase, product })
                    )
                    .cache(),
                c => c.id,
                p => p.purchase.customerID,
                (customer, purchases) => ({
                    ...customer,
                    purchases: purchases.map(p => p.product),
                })
            )
            .cache();

        expect(
            deepEquals(customers.take(2).asArray(), [
                {
                    id: 1,
                    first_name: "Antone",
                    last_name: "Wigfall",
                    email: "awigfall0@cmu.edu",
                    gender: "Male",
                    ip_address: "7.172.167.124",
                    city: "Chandler",
                    state: "AZ",
                    security_enabled: false,
                    profile_pic:
                        "https://robohash.org/hicvelnumquam.png?size=50x50&set=set1",
                    company_name: "Mymm",
                    bad_text: "Z̮̞̠͙͔ͅḀ̗̞͈̻̗Ḷ͙͎̯̹̞͓G̻O̭̗̮",
                    purchases: [
                        { name: "russian screwdriver", price: 713, id: 9 },
                        { name: "canadian squirt gun", price: 546, id: 11 },
                        {
                            name: "I can't believe it's butter",
                            price: 146,
                            id: 13,
                        },
                        {
                            name: "I can't believe it's butter",
                            price: 146,
                            id: 13,
                        },
                        { name: "message master", price: 353, id: 19 },
                        { name: "squirt gun", price: 885, id: 22 },
                        { name: "ajax bleach", price: 82, id: 31 },
                    ],
                },
                {
                    id: 2,
                    first_name: "Amelina",
                    last_name: "Iceton",
                    email: "aiceton1@wordpress.com",
                    gender: "Bigender",
                    ip_address: "109.61.168.68",
                    city: "Boston",
                    state: "MA",
                    security_enabled: false,
                    profile_pic:
                        "https://robohash.org/necessitatibusipsumsint.png?size=50x50&set=set1",
                    company_name: "Mybuzz",
                    bad_text: "ﾟ･✿ヾ╲(｡◕‿◕｡)╱✿･ﾟ",
                    purchases: [
                        { name: "mega-mart-express", price: 507, id: 7 },
                        { name: "russian screwdriver", price: 713, id: 9 },
                        {
                            name: "I can't believe it's butter",
                            price: 146,
                            id: 13,
                        },
                        { name: "message master", price: 353, id: 19 },
                        { name: "squirt gun", price: 885, id: 22 },
                        { name: "squirt gun", price: 885, id: 22 },
                        { name: "plant-based burger", price: 226, id: 27 },
                    ],
                },
            ])
        ).toBe(true);
    });
});

// TODO LOTS MORE TESTS TO WRITE!
