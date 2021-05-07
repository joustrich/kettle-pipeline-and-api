const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function getCsv(s3Bucket, s3Key) {
  const s3GetObjectParams = {
    Bucket: s3Bucket,
    Key: s3Key,
  };
  const { Body: csvBuffer } = await s3.getObject(s3GetObjectParams).promise();
  const csvString = csvBuffer.toString('utf8');
  return csvString;
}

async function saveCsv(s3Bucket, s3Key, csvString) {
  const s3PutObjectParams = {
    Bucket: s3Bucket,
    Key: s3Key,
    Body: csvString,
  };
  await s3.putObject(s3PutObjectParams).promise();
  return { success: true };
}

async function getS3PutUrl(clientId) {
  const putUrlParams = {
    Bucket: process.env.rawCsvBucket,
    Key: `${clientId}/${Math.floor(Date.now() / 1000)}.csv`,
  };
  const url = await s3.getSignedUrlPromise('putObject', putUrlParams);
  return url;
}

module.exports = {
  getCsv,
  saveCsv,
  getS3PutUrl,
};
