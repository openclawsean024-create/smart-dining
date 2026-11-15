import type { FastifyReply } from 'fastify';
import type { ZodTypeAny, z } from 'zod';

/**
 * 以 zod 驗證輸入；失敗時回 400 並回傳 undefined（呼叫端直接 return）。
 */
export function parseOr400<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
  reply: FastifyReply,
): z.infer<S> | undefined {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue?.path.length ? issue.path.join('.') + ': ' : '';
  void reply.code(400).send({ error: 'invalid request: ' + where + (issue?.message ?? 'validation failed') });
  return undefined;
}
