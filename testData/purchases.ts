import Stream from "../Stream";
import { lazy, random } from "../utils";
import { getCustomers } from "./customers";
import { getProducts } from "./products";

export const getPurchases = lazy(async () => {
    const customers = await getCustomers();
    const products = await getProducts();
    return customers
        .map(c =>
            Stream.generate(
                () => ({ customerID: c.id, productID: products.random().id }),
                random.choice([
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(0, 4),
                    () => random.int(5, 8),
                    () => random.int(5, 16),
                    () => random.int(10, 21),
                    () => random.int(100, 103),
                ])()
            )
        )
        .cache()
        .flat()
        .cache();
});
