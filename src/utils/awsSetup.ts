import { S3Client } from '@aws-sdk/client-s3';

const AWS_REGION = 'eu-central-1';

export const bucketName = 'ib-cyberpunk-barbershop-data';

export const s3Client = new S3Client({
  region: AWS_REGION,
});
