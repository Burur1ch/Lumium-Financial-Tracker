import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Вызываем обновление сессии из утилиты Supabase
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Исключаем все статические файлы, картинки и внутренние запросы Next.js.
     * Middleware сработает ТОЛЬКО на переходы по страницам дашборда и логина.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
