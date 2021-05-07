const AWS = require('aws-sdk');
const dynamoDbOptions = require('../constants/dynamoDbOptions');
const { IN_PROGRESS, VALIDATION_ERROR } = require('../constants/pipelineJobStatuses');

const db = new AWS.DynamoDB.DocumentClient(dynamoDbOptions);

async function getJobsForClient(clientId, lastEvaluatedKey, jobs = []) {
  const queryParams = {
    TableName: process.env.kettleTable,
    KeyConditionExpression: 'hashKey = :hashKey',
    ExpressionAttributeValues: {
      ':hashKey': `${clientId}:JOB`,
    },
  };
  if (lastEvaluatedKey) {
    queryParams.ExclusiveStartKey = lastEvaluatedKey;
  }
  const data = await db.query(queryParams).promise();
  if (data.Items && data.Items.length) {
    jobs.push(...data.Items);
  }
  if (data.LastEvaluatedKey) {
    return getJobsForClient(clientId, data.LastEvaluatedKey, jobs);
  }
  return jobs;
}

async function createJob(clientId, jobId, totalRecords, isValidationError, invalidRows = []) {
  const putParams = {
    TableName: process.env.kettleTable,
    Item: {
      hashKey: `${clientId}:JOB`,
      sortKey: jobId,
      jobStatus: IN_PROGRESS,
      totalRecords,
      createdAt: new Date().toISOString(),
    },
  };

  if (isValidationError) {
    putParams.Item.jobStatus = VALIDATION_ERROR;
    putParams.Item.numErrors = invalidRows.length;
    putParams.Item.errorRows = invalidRows;
  }

  await db.put(putParams).promise();
  return { success: true };
}

async function updateJob(clientId, jobId, jobStatus) {
  const updateParams = {
    TableName: process.env.kettleTable,
    Key: {
      hashKey: `${clientId}:JOB`,
      sortKey: jobId,
    },
    UpdateExpression: 'SET jobStatus = :jobStatus',
    ExpressionAttributeValues: {
      ':jobStatus': jobStatus,
    },
  };
  await db.update(updateParams).promise();
  return { success: true };
}

async function getJobBatchesForJob(clientId, jobId, lastEvaluatedKey, jobBatches = []) {
  const queryParams = {
    TableName: process.env.kettleTable,
    KeyConditionExpression: 'hashKey = :hashKey',
    ExpressionAttributeValues: {
      ':hashKey': `${clientId}:JOB_BATCH:${jobId}`,
    },
  };
  if (lastEvaluatedKey) {
    queryParams.ExclusiveStartKey = lastEvaluatedKey;
  }
  const data = await db.query(queryParams).promise();
  if (data.Items && data.Items.length) {
    jobBatches.push(...data.Items);
  }
  if (data.LastEvaluatedKey) {
    return getJobBatchesForJob(clientId, jobId, data.LastEvaluatedKey, jobBatches);
  }
  return jobBatches;
}

async function createJobBatch(clientId, jobId, batchNumber, totalRecords) {
  const putParams = {
    TableName: process.env.kettleTable,
    Item: {
      hashKey: `${clientId}:JOB_BATCH:${jobId}`,
      sortKey: `Batch_${batchNumber}`,
      jobStatus: IN_PROGRESS,
      totalRecords,
      createdAt: new Date().toISOString(),
    },
  };

  await db.put(putParams).promise();
  return { success: true };
}

async function updateJobBatch(clientId, jobId, batchNumber, jobStatus) {
  const updateParams = {
    TableName: process.env.kettleTable,
    Key: {
      hashKey: `${clientId}:JOB_BATCH:${jobId}`,
      sortKey: `Batch_${batchNumber}`,
    },
    UpdateExpression: 'SET jobStatus = :jobStatus',
    ExpressionAttributeValues: {
      ':jobStatus': jobStatus,
    },
  };
  await db.update(updateParams).promise();
  return { success: true };
}

module.exports = {
  getJobsForClient,
  createJob,
  updateJob,
  getJobBatchesForJob,
  createJobBatch,
  updateJobBatch,
};
