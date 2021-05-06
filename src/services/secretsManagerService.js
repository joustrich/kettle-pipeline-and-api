const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'us-west-2' });
const SECRET_ID = `${process.env.envName}-kettle-pipeline-and-api-secret`;

let secrets;

async function getSecrets() {
  if (secrets) {
    return secrets;
  }

  const { SecretString: secretString } = await secretsManager.getSecretValue({ SecretId: SECRET_ID }).promise();
  secrets = JSON.parse(secretString);
  return secrets;
}

module.exports = {
  getSecrets,
};
