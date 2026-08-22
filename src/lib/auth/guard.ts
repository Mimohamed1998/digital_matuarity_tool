import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

/**
 * The second gate (NFR-6).
 *
 * `middleware.ts` is the first, and it is a convenience: if its matcher were ever
 * misconfigured, or matching behaviour changed in a future Next.js version, every admin
 * page and route must still refuse on its own. Each one calls this.
 */
export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
