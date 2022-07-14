import Stream from "./Stream";

export default interface Streamable<T>{
    stream:() => Stream<T>
}