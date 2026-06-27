import dotenv from "dotenv";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

async function testS3Connection() {
  try {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME,
        MaxKeys: 5,
      })
    );

    console.log("✅ S3 Connection Successful");
    console.log("Bucket:", process.env.S3_BUCKET_NAME);
    console.log("Objects:", result.KeyCount);

    result.Contents?.forEach((obj) => {
      console.log("-", obj.Key);
    });
  } catch (err) {
    console.error("❌ S3 Connection Failed");
    console.error(err);
  }
}

testS3Connection();