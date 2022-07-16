import fs from "fs/promises";
import { lazy } from "./utils";
export async function getTestData(): Promise<
    {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        gender: "Male" | "Female" | "Non-binary";
        ip_address: string;
        city: string;
        state: string;
        security_enabled: boolean;
        profile_pic: string;
        company_name: string;
        bad_text: string;
    }[]
> {
    const data = await fs.readFile("testData.json");
    return JSON.parse(data.toString());
}
