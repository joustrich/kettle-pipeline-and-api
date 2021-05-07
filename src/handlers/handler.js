const AWSXRay = require('aws-xray-sdk-core');
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.captureHTTPsGlobal(require('https'));

const manager = require('../managers/manager');

function sendResponse(responseBody) {
  const response = {
    statusCode: 200,
    body: JSON.stringify(responseBody),
  };
  if (process.env.corsDomain) {
    response.headers = {
      'Access-Control-Allow-Origin': process.env.corsDomain,
    };
  }
  return response;
}

exports.getClients = async () => {
  try {
    AWSXRay.capturePromise();
    const response = await manager.getClients();
    return sendResponse(response);
  } catch (err) {
    console.error(err, err.message, err.stack);
    return err;
  }
};

exports.getJobsForClient = async (event) => {
  try {
    const { clientId } = event.pathParameters;
    AWSXRay.capturePromise();
    const response = await manager.getJobsForClient(clientId);
    return sendResponse(response);
  } catch (err) {
    console.error(err, err.message, err.stack);
    return err;
  }
};

exports.csvUploadUrl = async (event) => {
  try {
    const { clientId } = event.pathParameters;
    AWSXRay.capturePromise();
    const response = await manager.csvUploadUrl(clientId);
    return sendResponse(response);
  } catch (err) {
    console.error(err, err.message, err.stack);
    return err;
  }
};

exports.validateAndBatchCsv = async (event) => {
  try {
    const {
      bucket: { name: s3Bucket },
      object: { key: s3Key },
    } = event.Records[0].s3;
    AWSXRay.capturePromise();
    return await manager.validateAndBatchCsv(s3Bucket, s3Key);
  } catch (err) {
    console.error(err, err.message, err.stack);
    return err;
  }
};

exports.processCsv = async (event) => {
  try {
    const {
      bucket: { name: s3Bucket },
      object: { key: s3Key },
    } = event.Records[0].s3;
    AWSXRay.capturePromise();
    return await manager.processCsv(s3Bucket, s3Key);
  } catch (err) {
    console.error(err, err.message, err.stack);
    return err;
  }
};
