import { z } from 'zod';

type ParseJsonBodySuccess<T> = {
  success: true;
  data: T;
};

type ParseJsonBodyFailure = {
  success: false;
  response: Response;
};

type ParseJsonBodyResult<T> = ParseJsonBodySuccess<T> | ParseJsonBodyFailure;

function formatZodIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'body';
  }

  return ['body', ...path.map(String)].join('.');
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${formatZodIssuePath(issue.path)}: ${issue.message}`);
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<ParseJsonBodyResult<z.infer<TSchema>>> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      success: false,
      response: Response.json(
        { error: 'Invalid request payload', details: formatZodIssues(parsed.error) },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: parsed.data };
}

export function validatedJson<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
  init?: ResponseInit,
): Response {
  return Response.json(schema.parse(data), init);
}
