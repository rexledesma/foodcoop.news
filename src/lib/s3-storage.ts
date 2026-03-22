import { env as privateEnv } from '$env/dynamic/private';
import {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME,
} from '$env/static/private';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type ListOptions = {
  prefix?: string;
  token?: string;
};

type PutOptions = {
  contentType?: string;
  access?: 'public';
  allowOverwrite?: boolean;
  token?: string;
};

type DeleteOptions = {
  token?: string;
};

type S3Blob = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

let s3Client: S3Client | null = null;

const optionalPrivateEnv = privateEnv as Record<string, string | undefined>;

function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const forcePathStyle = optionalPrivateEnv['AWS_S3_FORCE_PATH_STYLE'] === 'true';
  const endpoint = optionalPrivateEnv['S3_ENDPOINT'];
  const sessionToken = optionalPrivateEnv['AWS_SESSION_TOKEN'];

  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      ...(sessionToken ? { sessionToken } : {}),
    },
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
  });

  return s3Client;
}

function encodeS3Key(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getSignedUrlTtlSeconds(): number {
  const raw = optionalPrivateEnv['S3_SIGNED_URL_TTL_SECONDS'];
  if (!raw) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  return Math.min(parsed, 604800);
}

async function getObjectUrl(pathname: string): Promise<string> {
  const publicBaseUrl = optionalPrivateEnv['S3_PUBLIC_BASE_URL'];
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, '')}/${encodeS3Key(pathname)}`;
  }

  const client = getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: pathname }), {
    expiresIn: getSignedUrlTtlSeconds(),
  });
}

function getBodySize(body: string | Uint8Array | Buffer | ArrayBuffer): number {
  if (typeof body === 'string') {
    return Buffer.byteLength(body);
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  return body.byteLength;
}

function toPutObjectBody(body: string | Uint8Array | Buffer | ArrayBuffer): string | Uint8Array {
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  return body;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'NotFound' || error.name === 'NoSuchKey' || error.name === '404';
}

export async function list(options: ListOptions = {}): Promise<{ blobs: S3Blob[] }> {
  const client = getS3Client();

  const listed: S3Blob[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET_NAME,
        Prefix: options.prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const contents = response.Contents ?? [];
    const blobs = await Promise.all(
      contents
        .filter((obj): obj is Required<Pick<typeof obj, 'Key'>> & typeof obj => Boolean(obj.Key))
        .map(async (obj) => {
          const pathname = obj.Key;
          return {
            url: await getObjectUrl(pathname),
            pathname,
            size: obj.Size ?? 0,
            uploadedAt: obj.LastModified ?? new Date(0),
          };
        }),
    );
    listed.push(...blobs);

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { blobs: listed };
}

export async function put(
  pathname: string,
  body: string | Uint8Array | Buffer | ArrayBuffer,
  options: PutOptions = {},
): Promise<S3Blob> {
  const client = getS3Client();

  if (!options.allowOverwrite) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: pathname,
        }),
      );
      throw new Error(`Object already exists at ${pathname}`);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: pathname,
      Body: toPutObjectBody(body),
      ContentType: options.contentType,
    }),
  );

  return {
    url: await getObjectUrl(pathname),
    pathname,
    size: getBodySize(body),
    uploadedAt: new Date(),
  };
}

export async function del(pathnames: string[], _options: DeleteOptions = {}): Promise<void> {
  if (pathnames.length === 0) {
    return;
  }

  const client = getS3Client();

  for (let i = 0; i < pathnames.length; i += 1000) {
    const chunk = pathnames.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: chunk.map((pathname) => ({ Key: pathname })),
          Quiet: true,
        },
      }),
    );
  }
}
