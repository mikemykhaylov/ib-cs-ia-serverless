import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DataSource } from 'apollo-datasource';

export type GetSignedURLGraphQLApiInput = {
  barberID: string;
  fileExtension: string;
};

export type GetSignedURLS3ApiInput = GetSignedURLGraphQLApiInput;

class AmazonS3API extends DataSource {
  private awsRegion: string;
  private bucketName: string;
  private s3Client: S3Client;
  // On class instancing we set up used vars
  constructor() {
    super();
    this.awsRegion = 'eu-central-1';
    this.bucketName = 'ib-cyberpunk-barbershop-data';
    this.s3Client = new S3Client({
      region: this.awsRegion,
    });
  }
  async getSignedURL({ barberID, fileExtension }: GetSignedURLS3ApiInput): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `barberProfileImages/${barberID}.${fileExtension}`,
    });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return url;
  }
}

export default AmazonS3API;
