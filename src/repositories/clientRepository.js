const AWS = require('aws-sdk');
const dynamoDbOptions = require('../constants/dynamoDbOptions');

const db = new AWS.DynamoDB.DocumentClient(dynamoDbOptions);

async function getClients(lastEvaluatedKey, clients = []) {
  const queryParams = {
    TableName: process.env.kettleTable,
    KeyConditionExpression: 'hashKey = :hashKey',
    ExpressionAttributeValues: {
      ':hashKey': 'CLIENT',
    },
  };
  if (lastEvaluatedKey) {
    queryParams.ExclusiveStartKey = lastEvaluatedKey;
  }
  const data = await db.query(queryParams).promise();
  if (data.Items && data.Items.length) {
    clients.push(...data.Items);
  }
  if (data.LastEvaluatedKey) {
    return getClients(data.LastEvaluatedKey, clients);
  }
  return clients;
}

module.exports = {
  getClients,
};
