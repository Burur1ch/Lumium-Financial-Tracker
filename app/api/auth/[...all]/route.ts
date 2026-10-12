import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/utils/auth/server";

export const { GET, POST } = toNextJsHandler(auth);