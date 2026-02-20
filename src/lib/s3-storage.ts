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

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getBucketName(): string {
  return getEnv('S3_BUCKET_NAME');
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';
  const endpoint = process.env.S3_ENDPOINT;

  s3Client = new S3Client({
    region: getEnv('AWS_REGION'),
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
  const raw = process.env.S3_SIGNED_URL_TTL_SECONDS;
  if (!raw) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Math.min(parsed, 604800);
}

async function getObjectUrl(pathname: string): Promise<string> {
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, '')}/${encodeS3Key(pathname)}`;
  }

  const client = getS3Client();
  const bucket = getBucketName();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: pathname }), {
    expiresIn: getSignedUrlTtlSeconds(),
  });
}

function getBodySize(body: string | Uint8Array | Buffer | ArrayBuffer): number {
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (body instanceof ArrayBuffer) return body.byteLength;
  return body.byteLength;
}

function toPutObjectBody(body: string | Uint8Array | Buffer | ArrayBuffer): string | Uint8Array {
  if (typeof body === 'string') return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return body;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'NotFound' || error.name === 'NoSuchKey' || error.name === '404';
}

export async function list(options: ListOptions = {}): Promise<{ blobs: S3Blob[] }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const listed: S3Blob[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
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
  const bucket = getBucketName();

  if (!options.allowOverwrite) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: pathname,
        }),
      );
      throw new Error(`Object already exists at ${pathname}`);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
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
  if (pathnames.length === 0) return;

  const client = getS3Client();
  const bucket = getBucketName();

  for (let i = 0; i < pathnames.length; i += 1000) {
    const chunk = pathnames.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((pathname) => ({ Key: pathname })),
          Quiet: true,
        },
      }),
    );
  }
}
