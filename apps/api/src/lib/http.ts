export async function readJson<T>(req: any): Promise<T> {
  // Fastify parses JSON bodies by default; keep a helper in case we add raw bodies later.
  return req.body as T;
}

export function assertBearerAuth(authorization: string | undefined, expected: string) {
  const prefix = "Bearer ";
  if (!authorization || !authorization.startsWith(prefix)) return false;
  const token = authorization.slice(prefix.length);
  // Constant-time compare is ideal; keep minimal here.
  return token === expected;
}

