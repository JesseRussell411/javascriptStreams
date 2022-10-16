import Stream from "../Stream";
import { random } from "../utils";

const productNames = [
    "power blaster 9000",
    "super scoot",
    "ajax bleach",
    "just a dead thing",
    "powerBook",
    "apple",
    "orange",
    "banana mania",
    "junk master",
    "message master",
    "in-fruit-inator",
    "I can't believe it's butter",
    "mega string",
    "mega-mart-express",
    "sack of hammers",
    "russian screwdriver",
    "lip bomb",
    "ridiculous soaker",
    "squirt gun",
    "canadian squirt gun",
    "turkey baster",
    "ajax extreme",
    "powdered milk",
    "powdered cheese",
    "gas-cooker",
    "plant-based burger",
    "meat-based veggies",
    "X-treme sunglasses",
    "rocket scooter",
    "lip balm",
    "nuclear lip balm",
    "quarter master",
];
let id = 1;

const products = Stream.from(productNames)
    .shuffle()
    .map((name, i) => ({
        name,
        price: Math.round(Math.random() * 30 * 100) / 100,
        id: i + 1,
    }))
    .cache();

export async function getProducts(){
    return products;
}
