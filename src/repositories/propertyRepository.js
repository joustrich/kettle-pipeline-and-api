const AWS = require('aws-sdk');
const dynamoDbOptions = require('../constants/dynamoDbOptions');

const db = new AWS.DynamoDB.DocumentClient(dynamoDbOptions);

function checkForUnprocessedItems(result, retry = 1) {
  if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
    if (retry < 3) {
      return retryBatchWrite(result.UnprocessedItems, retry + 1);
    }
    const unprocessedItems = result.UnprocessedItems[process.env.kettleTable].map((unprocessedItem) => unprocessedItem.PutRequest.Item);
    return { success: false, unprocessedItems };
  }
  return { success: true };
}

async function retryBatchWrite(unprocessedItems, retry) {
  const retryBatchWriteParams = {
    RequestItems: unprocessedItems,
  };
  const result = await db.batchWrite(retryBatchWriteParams).promise();
  return checkForUnprocessedItems(result, retry);
}

async function batchWriteProperties(properties) {
  const batchWriteParams = {
    RequestItems: {
      [process.env.kettleTable]: properties.map((property) => ({
        PutRequest: {
          Item: property,
        },
      })),
    },
  };
  const result = await db.batchWrite(batchWriteParams).promise();
  return checkForUnprocessedItems(result);
}

module.exports = {
  batchWriteProperties,
};
